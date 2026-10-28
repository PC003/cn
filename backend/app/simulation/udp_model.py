"""
Simplified UDP-like transport.

Behaviour
---------
* **No handshake, no congestion control.** The sender paces datagrams at
  ``udp_pacing_factor x`` the selected media bitrate (it never looks at loss or
  throughput). If that exceeds the bottleneck rate, the queue overflows and
  datagrams are dropped - the model shows *why* UDP needs application-level
  rate adaptation.
* **Independent datagrams.** Each datagram has its own loss draw (same draws
  as the TCP-like model's first transmission), its own one-way delay with
  jitter, and may overtake earlier datagrams (reordering is counted).
* **No transport retransmission.** Whatever recovery exists is an *application
  policy* (``udp_recovery``):

  - ``none``: accept whatever arrived by the receiver's gap timer.
  - ``arq``: the client NACKs missing datagrams; the server resends them
    (up to ``udp_max_repair_rounds`` rounds, each costing >= 1 RTT).
  - ``fec``: every ``udp_fec_block`` data packets are followed by parity
    packets (``udp_fec_overhead``); a block is recovered if at least as many
    packets arrive as there are data packets (idealised MDS erasure code).

* **Incomplete segments** are handled by ``udp_on_incomplete``: ``accept``
  plays the damaged segment with a configurable concealment penalty, ``drop``
  discards it (counted as lost content).

Not modelled: RTP/RTCP, real codecs' error propagation, real FEC codes,
NAT/firewall effects, header overhead.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from app.simulation.config import TransportConfig
from app.simulation.network import STREAM_JITTER, STREAM_LOSS, NetworkModel
from app.simulation.packet import Packet
from app.simulation.transport import SegmentDelivery, Transport

GAP_TIMER_MARGIN_S = 0.010  # receiver waits this long beyond the jitter allowance


class UdpLikeTransport(Transport):
    name = "udp"
    label = "UDP-like (simplified)"

    def connect(self, t: float) -> tuple[float, list[dict[str, Any]]]:
        self.connected_at = t
        return t, [{"t": round(t, 4), "type": "connected",
                    "detail": "UDP-like: connectionless, no handshake"}]

    # ------------------------------------------------------------------- helpers
    def _one_way_delays(self, send_times: np.ndarray, segment: int, attempt: int) -> np.ndarray:
        net = self.net
        base = np.array([net.rtt_s_at(float(s)) for s in send_times]) / 2.0 \
            if net.cfg.impairments else np.full(send_times.shape, net.base_rtt_s / 2.0)
        z = net.normal_draws(STREAM_JITTER, segment, attempt, len(send_times))
        return np.maximum(0.1 * base, base + z * net.jitter_s)

    def _bottleneck(self, send_times: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Departure times from the bottleneck and a mask of queue-overflow drops."""
        net = self.net
        rates = net.rates_at(send_times) * 1e6
        service = self.pkt_bits / rates
        n = len(send_times)
        send_rate_ok = np.all((send_times[1:] - send_times[:-1]) >= service[1:] - 1e-12) if n > 1 else True
        if send_rate_ok:
            return send_times + service, np.zeros(n, dtype=bool)
        dep = np.empty(n)
        drop = np.zeros(n, dtype=bool)
        busy = -math.inf
        q = net.cfg.queue_packets
        for i in range(n):
            s = send_times[i]
            if busy - s > q * service[i]:
                drop[i] = True
                dep[i] = math.inf
                continue
            busy = max(s, busy) + service[i]
            dep[i] = busy
        return dep, drop

    # ------------------------------------------------------------------- deliver
    def deliver(
        self, segment: int, size_bytes: int, t_request: float, bitrate_mbps: float
    ) -> SegmentDelivery:
        net, cfg = self.net, self.cfg
        n = self.n_packets(size_bytes)
        events: list[dict[str, Any]] = []
        pkt_bits = self.pkt_bits

        # Packet layout: data packets, plus parity packets after each FEC block.
        block_of = np.zeros(n, dtype=np.int64)
        if cfg.udp_recovery == "fec":
            blocks: list[tuple[int, int, int]] = []  # (first_data, n_data, n_parity)
            for b0 in range(0, n, cfg.udp_fec_block):
                nd = min(cfg.udp_fec_block, n - b0)
                npar = max(1, math.ceil(nd * cfg.udp_fec_overhead))
                blocks.append((b0, nd, npar))
            total = n + sum(b[2] for b in blocks)
            block_of = np.zeros(total, dtype=np.int64)
            data_pos = np.zeros(n, dtype=np.int64)
            pos = 0
            for bi, (b0, nd, npar) in enumerate(blocks):
                for j in range(nd):
                    data_pos[b0 + j] = pos
                    block_of[pos] = bi
                    pos += 1
                for _ in range(npar):
                    block_of[pos] = bi
                    pos += 1
        else:
            total = n
            data_pos = np.arange(n)

        rate_bps = cfg.udp_pacing_factor * bitrate_mbps * 1e6
        if rate_bps <= 0:
            rate_bps = net.rate_mbps_at(t_request) * 1e6
        d = pkt_bits / rate_bps
        rtt0 = net.rtt_s_at(t_request)
        t_start = t_request + rtt0 / 2.0
        send = t_start + np.arange(total) * d

        dep, qdrop = self._bottleneck(send)
        u = net.uniform_draws(STREAM_LOSS, segment, 0, total)
        rand_lost = u < net.loss_at_many(send)
        lost = rand_lost | qdrop
        arrival = np.where(lost, np.inf, dep + self._one_way_delays(send, segment, 0))

        # Reordering: delivered datagrams that arrive before a datagram sent earlier.
        fin = np.where(np.isfinite(arrival), arrival, -np.inf)
        run_max = np.maximum.accumulate(fin)
        reordered = int(np.count_nonzero(np.isfinite(arrival[1:]) & (arrival[1:] < run_max[:-1] - 1e-12)))

        last_dep = float(np.max(np.where(np.isfinite(dep), dep, send)))
        tol = 3.0 * net.jitter_s + GAP_TIMER_MARGIN_S
        deadline = last_dep + net.rtt_s_at(last_dep) / 2.0 + tol
        late = np.isfinite(arrival) & (arrival > deadline)
        recv = np.isfinite(arrival) & ~late

        sent = total
        lost_total = int(lost.sum())
        retx = 0
        fec_recovered = 0
        repair_rounds = 0
        first_byte = float(np.min(arrival[recv])) if recv.any() else deadline

        data_recv = recv[data_pos].copy()
        data_arr = arrival[data_pos].copy()
        data_arr[~data_recv] = np.inf

        # ---- FEC: recover whole blocks that received >= data-count packets ----------
        if cfg.udp_recovery == "fec":
            for bi, (b0, nd, npar) in enumerate(blocks):
                mask = block_of == bi
                got = recv & mask
                cnt = int(got.sum())
                if cnt >= nd:
                    block_arr = np.sort(arrival[got])
                    t_ready = float(block_arr[nd - 1])
                    miss = ~data_recv[b0:b0 + nd]
                    fec_recovered += int(miss.sum())
                    data_arr[b0:b0 + nd] = np.where(miss, t_ready, data_arr[b0:b0 + nd])
                    data_recv[b0:b0 + nd] = True
            if fec_recovered:
                events.append({"t": round(deadline, 4), "type": "fec_recovery",
                               "detail": f"seg {segment}: FEC rebuilt {fec_recovered} packet(s)"})

        # ---- ARQ: NACK + resend, bounded rounds --------------------------------
        t_now = deadline
        if cfg.udp_recovery == "arq":
            for r in range(1, cfg.udp_max_repair_rounds + 1):
                missing = np.nonzero(~data_recv)[0]
                if len(missing) == 0:
                    break
                repair_rounds += 1
                rtt = net.rtt_s_at(t_now)
                t_s = t_now + rtt / 2.0  # NACK reaches the server
                m = len(missing)
                rate = net.rate_mbps_at(t_s) * 1e6
                gap = max(d, pkt_bits / rate)
                send_r = t_s + np.arange(m) * gap
                dep_r = send_r + pkt_bits / rate
                u_r = net.uniform_draws(STREAM_LOSS, segment, r, n)[missing]
                lost_r = u_r < net.loss_at_many(send_r)
                arr_r = np.where(lost_r, np.inf,
                                 dep_r + self._one_way_delays(send_r, segment, r))
                sent += m
                retx += m
                lost_total += int(lost_r.sum())
                got = np.isfinite(arr_r)
                data_arr[missing[got]] = arr_r[got]
                data_recv[missing[got]] = True
                events.append({"t": round(t_now, 4), "type": "repair_round",
                               "detail": f"seg {segment}: NACK for {m} packet(s), "
                                         f"{int(got.sum())} repaired in round {r}"})
                t_end = float(np.max(dep_r)) + net.rtt_s_at(float(np.max(dep_r))) / 2.0 + tol
                if got.all():
                    t_now = float(np.max(arr_r[got]))
                else:
                    t_now = max(t_end, float(np.max(arr_r[got])) if got.any() else t_end)

        frac = float(np.count_nonzero(data_recv)) / n
        if frac >= 1.0:
            finite = data_arr[np.isfinite(data_arr)]
            t_complete = float(finite.max()) if len(finite) else deadline
        else:
            t_complete = max(t_now, deadline)
            events.append({"t": round(t_complete, 4), "type": "incomplete_segment",
                           "detail": f"seg {segment}: {100 * frac:.1f}% of packets recovered "
                                     f"({'dropped' if cfg.udp_on_incomplete == 'drop' else 'played with gaps'})"})

        n_late = int(late.sum())
        trace: list[Packet] = []
        if self.packet_trace_limit > 0 and segment == 0:
            for i in range(min(total, self.packet_trace_limit)):
                trace.append(Packet(
                    packet_id=i, segment_id=segment, sequence_number=i, size_bytes=cfg.mss_bytes,
                    send_time=float(send[i]),
                    arrival_time=float(arrival[i]) if np.isfinite(arrival[i]) else None,
                    lost=bool(lost[i]), retransmitted=False, delivered=bool(recv[i]),
                    in_order=bool(recv[i] and arrival[i] >= run_max[i - 1] - 1e-12) if i else bool(recv[i]),
                ))

        return SegmentDelivery(
            segment=segment, size_bytes=size_bytes, t_request=t_request,
            t_first_byte=first_byte, t_complete=t_complete, packets=n, packets_sent=sent,
            packets_lost=lost_total, retransmissions=retx, fast_retransmits=0, timeouts=0,
            hol_blocked_packets=0, hol_blocked_packet_s=0.0, reordered_packets=reordered,
            late_packets=n_late, repair_rounds=repair_rounds, fec_recovered_packets=fec_recovered,
            delivered_fraction=frac, cwnd_end=None, events=events, packet_trace=trace,
        )


def run_udp_transfer(
    net: NetworkModel, cfg: TransportConfig, size_bytes: int, bitrate_mbps: float,
    t_request: float = 0.0, seed: int = 0,
) -> SegmentDelivery:
    """Convenience: fetch one object over the UDP-like model."""
    tr = UdpLikeTransport(net, cfg, seed)
    ready, _ = tr.connect(t_request)
    return tr.deliver(0, size_bytes, ready, bitrate_mbps)
