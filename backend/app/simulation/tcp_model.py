"""
Simplified TCP-like reliable transport (round-based model).

What is modelled
----------------
* Connection setup: ``handshake_rtts`` round trips (default 2 = TCP handshake +
  TLS 1.3), each flight lost with the path's loss probability (initial RTO 1 s,
  doubling).
* Request: the GET reaches the server half an RTT after it is sent.
* Congestion-window sending in rounds: a round puts ``min(cwnd, rwnd)`` packets
  (retransmissions first) on the path; the round lasts ``max(RTT, serialisation
  time of the burst)``, so throughput is ``min(cwnd*MSS/RTT, bandwidth)``.
* Loss: random loss (``loss_probability`` + impairments) plus tail-drop loss
  when a burst exceeds BDP + bottleneck queue.
* Recovery: a lost packet followed by >= 3 delivered packets in the same round
  is a fast retransmit (window halved once per loss event, repair next round).
  Otherwise (tail loss / whole round lost) a retransmission timeout fires
  (``RTO = max(min_rto, 2*RTT)``, exponential backoff, window -> 1).
* Head-of-line blocking: the receiver releases bytes to the application in
  order, so packets that arrive behind a hole wait for the retransmission. The
  waiting time is measured exactly from the per-packet arrival times.
* Slow start after idle (configurable).

What is NOT modelled
--------------------
Real ACK clocking and delayed ACKs, SACK scoreboards, RACK/TLP, PRR, CUBIC/BBR,
pacing, bufferbloat dynamics, cross traffic, header overhead, receive-buffer
autotuning, TLS record framing. It is a *TCP-like* teaching model, not an
implementation of TCP.
"""

from __future__ import annotations

import math
from typing import Any, Optional

import numpy as np

from app.simulation.config import TransportConfig
from app.simulation.congestion import CongestionController
from app.simulation.network import STREAM_HANDSHAKE, STREAM_JITTER, STREAM_LOSS, NetworkModel
from app.simulation.packet import Packet
from app.simulation.transport import SegmentDelivery, SimulationError, Transport

MAX_ROUNDS = 200_000
INITIAL_RTO_S = 1.0  # RFC 6298 initial retransmission timer for lost handshake flights
DUPACK_THRESHOLD = 3


class ReliableTransport(Transport):
    """Reliable, congestion-controlled delivery. ``n_streams`` > 1 gives per-stream ordering."""

    name = "tcp"
    label = "TCP-like (simplified)"
    default_handshake_rtts = 2.0
    default_min_rto_s = 0.200
    n_streams = 1

    def __init__(self, net: NetworkModel, cfg: TransportConfig, seed: int, packet_trace_limit: int = 0):
        super().__init__(net, cfg, seed, packet_trace_limit)
        self.cc = CongestionController(cfg.init_cwnd_packets, cfg.rwnd_packets)
        self.handshake_rtts = (
            cfg.handshake_rtts if cfg.handshake_rtts is not None else self.default_handshake_rtts
        )
        self.min_rto_s = (
            cfg.min_rto_ms / 1000.0 if cfg.min_rto_ms is not None else self.default_min_rto_s
        )
        self.last_activity = 0.0

    # ------------------------------------------------------------------ handshake
    def connect(self, t: float) -> tuple[float, list[dict[str, Any]]]:
        rtt = self.net.rtt_s_at(t)
        flights = int(math.ceil(self.handshake_rtts))
        extra = 0.0
        events: list[dict[str, Any]] = []
        if flights > 0:
            p_flight = 1.0 - (1.0 - self.net.loss_at(t)) ** 2  # request + response both must survive
            draws = self.net.uniform_draws(STREAM_HANDSHAKE, 0, 0, flights * 8)
            k = 0
            for f in range(flights):
                tries = 0
                while draws[k] < p_flight and tries < 7:
                    extra += INITIAL_RTO_S * (2 ** tries)
                    tries += 1
                    k += 1
                    if k >= len(draws):
                        break
                k = min(k + 1, len(draws) - 1)
                if tries:
                    events.append({"t": round(t, 4), "type": "handshake_loss",
                                   "detail": f"handshake flight {f + 1} lost {tries}x"})
        ready = t + self.handshake_rtts * rtt + extra
        events.append({"t": round(ready, 4), "type": "connected",
                       "detail": f"{self.label} ready after {ready - t:.3f}s "
                                 f"({self.handshake_rtts:g} RTT handshake"
                                 f"{', +%.2fs loss recovery' % extra if extra else ''})"})
        self.connected_at = ready
        self.last_activity = ready
        return ready, events

    # --------------------------------------------------------------------- deliver
    def deliver(
        self, segment: int, size_bytes: int, t_request: float, bitrate_mbps: float
    ) -> SegmentDelivery:
        net, cc, cfg = self.net, self.cc, self.cfg
        n = self.n_packets(size_bytes)
        pkt_bits = self.pkt_bits
        events: list[dict[str, Any]] = []

        rtt0 = net.rtt_s_at(t_request)
        t = t_request + rtt0 / 2.0  # request reaches the server
        if cfg.slow_start_after_idle and t_request - self.last_activity > max(
            self.min_rto_s, 2.0 * rtt0
        ):
            if cc.cwnd > cc.init_cwnd:
                events.append({"t": round(t_request, 4), "type": "idle_restart",
                               "detail": f"idle {t_request - self.last_activity:.1f}s: cwnd "
                                         f"{cc.cwnd:.0f} -> {cc.init_cwnd:.0f}"})
            cc.on_idle_restart()

        u_cache: dict[int, np.ndarray] = {0: net.uniform_draws(STREAM_LOSS, segment, 0, n)}
        jitter_draws = net.normal_draws(STREAM_JITTER, segment, 0, 1024)

        def u_for(attempt: int) -> np.ndarray:
            if attempt not in u_cache:
                u_cache[attempt] = net.uniform_draws(STREAM_LOSS, segment, attempt, n)
            return u_cache[attempt]

        attempts = np.zeros(n, dtype=np.int32)
        arrival = np.full(n, np.nan)
        n_delivered = 0
        next_new = 0
        pending: list[int] = []
        backoff = 1.0
        rounds = 0

        sent = lost_total = retx = fast_events = timeouts = 0
        first_byte: Optional[float] = None
        trace_rows: list[tuple[int, float, float, bool, bool]] = []
        trace_on = self.packet_trace_limit > 0 and segment == 0

        while n_delivered < n:
            rounds += 1
            if rounds > MAX_ROUNDS:
                raise SimulationError("reliable transfer did not converge (too many rounds)")
            w = cc.window
            take_retx = pending[:w]
            pending = pending[w:]
            room = w - len(take_retx)
            new_hi = min(n, next_new + room) if room > 0 else next_new
            new_idx = list(range(next_new, new_hi))
            next_new = new_hi
            batch = np.array(take_retx + new_idx, dtype=np.int64)
            k = len(batch)
            if k == 0:  # nothing to send but undelivered packets pending (should not happen)
                raise SimulationError("empty batch with undelivered packets")

            rtt_base = net.rtt_s_at(t)
            jit = jitter_draws[rounds % len(jitter_draws)] * net.jitter_s * math.sqrt(2.0)
            rtt_s = max(0.5 * rtt_base, rtt_base + jit)
            tx = net.transfer_time(t, k * pkt_bits)
            rate_bps = net.rate_mbps_at(t) * 1e6
            capacity = int(rate_bps * rtt_s / pkt_bits + net.cfg.queue_packets)
            overflow = max(0, k - max(capacity, 1))

            p = net.loss_at(t)
            att = attempts[batch]
            u = np.empty(k)
            for a in np.unique(att):
                m = att == a
                u[m] = u_for(int(a))[batch[m]]
            lost = u < p
            if overflow:
                lost[k - overflow:] = True
            attempts[batch] += 1

            round_end = t + max(rtt_s, tx)
            arr_j = t + (np.arange(1, k + 1) / k) * tx + rtt_s / 2.0
            ok = ~lost
            retx += int(np.count_nonzero(att > 0))
            sent += k
            n_lost = int(np.count_nonzero(lost))
            lost_total += n_lost
            if first_byte is None and ok.any():
                first_byte = float(arr_j[np.argmax(ok)])

            if trace_on:
                lim = self.packet_trace_limit
                for j in range(k):
                    if batch[j] < lim:
                        trace_rows.append((int(batch[j]), t, float(arr_j[j]), bool(lost[j]),
                                           bool(att[j] > 0)))

            idx_ok = batch[ok]
            arrival[idx_ok] = arr_j[ok]
            n_delivered += len(idx_ok)

            if n_lost == 0:
                cc.on_round_acked(k, window_was_full=(k >= w))
                backoff = 1.0
                t = round_end
                continue

            # --- loss handling ------------------------------------------------
            delivered_after = int(ok.sum()) - np.cumsum(ok)  # delivered packets sent after j
            lost_pos = np.nonzero(lost)[0]
            fast_mask = delivered_after[lost_pos] >= DUPACK_THRESHOLD
            lost_idx = batch[lost_pos].tolist()
            slow_needed = bool((~fast_mask).any())
            if slow_needed:
                rto = max(self.min_rto_s, 2.0 * rtt_s) * backoff
                t_next = max(round_end, t + rto)
                cc.on_timeout()
                timeouts += 1
                backoff = min(backoff * 2.0, 64.0)
                events.append({"t": round(t_next, 4), "type": "timeout",
                               "detail": f"seg {segment}: RTO after {n_lost} lost packet(s); "
                                         f"cwnd -> {cc.cwnd:.0f}, waited {t_next - t:.3f}s"})
            else:
                cc.on_fast_loss()
                fast_events += 1
                t_next = round_end
                backoff = 1.0
                events.append({"t": round(t_next, 4), "type": "fast_retransmit",
                               "detail": f"seg {segment}: {n_lost} lost, 3+ dup-acks; "
                                         f"cwnd -> {cc.cwnd:.0f}"})
            pending = lost_idx + pending
            t = t_next

        # --- in-order release (head-of-line blocking) ------------------------------
        release = _in_order_release(arrival, self.n_streams)
        wait = release - arrival
        hol_mask = wait > 1e-9
        t_complete = float(release.max())
        self.last_activity = t_complete

        trace: list[Packet] = []
        for pid, (idx, send_t, arr_t, was_lost, was_retx) in enumerate(trace_rows):
            trace.append(Packet(
                packet_id=pid, segment_id=segment, sequence_number=idx, size_bytes=cfg.mss_bytes,
                send_time=send_t, arrival_time=None if was_lost else arr_t,
                lost=was_lost, retransmitted=was_retx, delivered=not was_lost,
                in_order=bool(not was_lost and not hol_mask[idx]),
            ))

        return SegmentDelivery(
            segment=segment, size_bytes=size_bytes, t_request=t_request,
            t_first_byte=first_byte if first_byte is not None else t_complete,
            t_complete=t_complete, packets=n, packets_sent=sent, packets_lost=lost_total,
            retransmissions=retx, fast_retransmits=fast_events, timeouts=timeouts,
            hol_blocked_packets=int(hol_mask.sum()), hol_blocked_packet_s=float(wait.sum()),
            delivered_fraction=1.0, cwnd_end=cc.cwnd, events=events, packet_trace=trace,
        )


def _in_order_release(arrival: np.ndarray, n_streams: int) -> np.ndarray:
    """Time each packet is released to the application given in-order delivery per stream."""
    if n_streams <= 1:
        return np.maximum.accumulate(arrival)
    out = np.empty_like(arrival)
    for s in range(n_streams):
        out[s::n_streams] = np.maximum.accumulate(arrival[s::n_streams])
    return out


class TcpLikeTransport(ReliableTransport):
    name = "tcp"
    label = "TCP-like (simplified)"


def run_tcp_transfer(
    net: NetworkModel, cfg: TransportConfig, size_bytes: int, t_request: float = 0.0, seed: int = 0
) -> SegmentDelivery:
    """Convenience: connect, then fetch one object. Used by the Mathis validation."""
    tr = TcpLikeTransport(net, cfg, seed)
    ready, _ = tr.connect(t_request)
    return tr.deliver(0, size_bytes, ready, 0.0)
