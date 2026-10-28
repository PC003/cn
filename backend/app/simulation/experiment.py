"""
Experiment controller: one full, seeded streaming session.

    Network -> Transport -> Segment download -> Buffer -> ABR -> Playback -> QoE

A single ``SimulationConfig`` (including the seed) fully determines the result:
the same configuration yields byte-identical output. The engine has no
dependency on the web layer, so it can be driven from tests or the CLI.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from app.simulation.abr import make_abr
from app.simulation.buffer import PLAYING, PlaybackBuffer
from app.simulation.config import DEFAULT_LADDER_LABELS, DEFAULT_LADDER_MBPS, SimulationConfig
from app.simulation.network import NetworkModel
from app.simulation.qoe import SegmentPlayback, compute_qoe
from app.simulation.quic_model import QuicLikeTransport
from app.simulation.tcp_model import TcpLikeTransport
from app.simulation.transport import Transport
from app.simulation.udp_model import UdpLikeTransport

MODEL_NOTE = (
    "Simplified educational model: TCP-like/UDP-like/QUIC-like transports are not full "
    "protocol implementations, there is no cross traffic, and QoE is a documented linear score."
)
MAX_EVENTS_PER_SEGMENT = 6


def level_label(ladder: list[float], level: int) -> str:
    if ladder == DEFAULT_LADDER_MBPS and level < len(DEFAULT_LADDER_LABELS):
        return DEFAULT_LADDER_LABELS[level]
    return f"{ladder[level]:g} Mbps"


def make_transport(cfg: SimulationConfig, net: NetworkModel) -> Transport:
    tcfg = cfg.transport
    cls = {"tcp": TcpLikeTransport, "udp": UdpLikeTransport, "quic": QuicLikeTransport}[tcfg.protocol]
    return cls(net, tcfg, cfg.seed, cfg.packet_trace_limit)


def segment_size_megabits(bitrate_mbps: float, duration_s: float) -> float:
    """Segment size in megabits = R x T."""
    return bitrate_mbps * duration_s


def segment_size_bytes(bitrate_mbps: float, duration_s: float) -> int:
    """Megabits -> bytes: x 1e6 bit / 8."""
    return int(round(segment_size_megabits(bitrate_mbps, duration_s) * 1e6 / 8.0))


@dataclass
class SessionResult:
    data: dict[str, Any]

    def __getitem__(self, key: str) -> Any:
        return self.data[key]

    def to_dict(self) -> dict[str, Any]:
        return self.data


def run_session(cfg: SimulationConfig) -> SessionResult:
    cfg.validate()
    v, tcfg = cfg.video, cfg.transport
    n_seg = int(math.ceil(v.duration_s / v.segment_s - 1e-9))
    net = NetworkModel(cfg.network, cfg.seed, horizon_s=v.duration_s * 8 + 300)
    transport = make_transport(cfg, net)
    abr = make_abr(cfg.abr, v.ladder_mbps, v.max_buffer_s)
    buf = PlaybackBuffer(v.startup_buffer_s, v.rebuffer_resume_s, v.duration_s)

    events: list[dict[str, Any]] = []
    segments: list[dict[str, Any]] = []
    played: list[SegmentPlayback] = []
    deliveries = []
    packet_trace: list[dict[str, Any]] = []

    t, hs_events = transport.connect(0.0)
    events.extend(hs_events)
    buf.advance(t)

    for i in range(n_seg):
        seg_dur = min(v.segment_s, v.duration_s - i * v.segment_s)
        wait_s = 0.0
        if buf.state == PLAYING and buf.level_s + seg_dur > v.max_buffer_s:
            wait_s = buf.level_s + seg_dur - v.max_buffer_s
            events.append({"t": round(t, 4), "type": "buffer_full_wait",
                           "detail": f"buffer {buf.level_s:.1f}s + segment {seg_dur:g}s exceeds max "
                                     f"{v.max_buffer_s:g}s: idle {wait_s:.2f}s"})
            t += wait_s
        buf.advance(t)
        buffer_before = buf.level_s

        decision = abr.decide(i, buf.level_s)
        bitrate = decision.bitrate_mbps
        size_b = segment_size_bytes(bitrate, seg_dur)
        events.append({"t": round(t, 4), "type": "abr_decision",
                       "detail": f"seg {i}: {level_label(v.ladder_mbps, decision.level)} "
                                 f"({bitrate:g} Mbps) [{decision.rule}] {decision.reason}"})
        events.append({"t": round(t, 4), "type": "segment_request",
                       "detail": f"seg {i}: GET {size_b / 1e6:.2f} MB"})

        d = transport.deliver(i, size_b, t, bitrate)
        deliveries.append(d)
        for e in d.events[:MAX_EVENTS_PER_SEGMENT]:
            events.append(e)
        if len(d.events) > MAX_EVENTS_PER_SEGMENT:
            events.append({"t": round(d.t_complete, 4), "type": "events_truncated",
                           "detail": f"seg {i}: {len(d.events) - MAX_EVENTS_PER_SEGMENT} more "
                                     f"transport events omitted from the log"})
        if d.packet_trace:
            packet_trace = [
                {"packet_id": p.packet_id, "segment": p.segment_id, "seq": p.sequence_number,
                 "send_time": round(p.send_time, 5),
                 "arrival_time": None if p.arrival_time is None else round(p.arrival_time, 5),
                 "lost": p.lost, "retransmitted": p.retransmitted, "delivered": p.delivered,
                 "in_order": p.in_order}
                for p in d.packet_trace
            ]

        buf.advance(d.t_complete)
        frac = d.delivered_fraction
        if tcfg.protocol == "udp":
            if tcfg.udp_on_incomplete == "drop":
                qf = 1.0 if frac >= 1.0 else 0.0
            else:
                qf = max(0.0, 1.0 - tcfg.udp_concealment_penalty * (1.0 - frac))
        else:
            qf = 1.0
        buf.add(seg_dur)
        events.append({"t": round(d.t_complete, 4), "type": "segment_complete",
                       "detail": f"seg {i}: {d.duration_s:.2f}s, {d.goodput_mbps:.2f} Mbps goodput"
                                 f"{'' if frac >= 1 else f', {100 * frac:.1f}% delivered'}"})

        thr = d.goodput_mbps
        abr.observe(thr)
        played.append(SegmentPlayback(bitrate, seg_dur, qf))
        row = decision.to_dict()
        row.update({
            "label": level_label(v.ladder_mbps, decision.level),
            "duration_s": seg_dur,
            "size_megabits": round(segment_size_megabits(bitrate, seg_dur), 4),
            "size_bytes": size_b,
            "idle_wait_s": round(wait_s, 4),
            "buffer_before_s": round(buffer_before, 3),
            "buffer_after_s": round(buf.level_s, 3),
            "throughput_mbps": round(thr, 4),
            "quality_factor": round(qf, 4),
        })
        row.update({k: val for k, val in d.to_dict().items() if k not in ("segment",)})
        segments.append(row)
        t = d.t_complete

    buf.finish()
    events.extend(buf.events)
    events.sort(key=lambda e: e["t"])

    qoe = compute_qoe(played, min(v.ladder_mbps), max(v.ladder_mbps), buf.startup_delay_s, buf.rebuffer_s,
                      buf.rebuffer_events, cfg.qoe)

    end_t = buf.ended_at if buf.ended_at is not None else buf.t
    total_bytes = sum(s["size_bytes"] * s["delivered_fraction"] for s in segments)
    metrics = {
        "protocol": tcfg.protocol,
        "abr": cfg.abr.strategy,
        "seed": cfg.seed,
        "segments": n_seg,
        "startup_delay_s": qoe["startup_delay_s"],
        "rebuffer_s": qoe["rebuffer_s"],
        "rebuffer_events": qoe["rebuffer_events"],
        "rebuffer_ratio": qoe["rebuffer_ratio"],
        "avg_bitrate_mbps": qoe["avg_bitrate_mbps"],
        "avg_delivered_bitrate_mbps": qoe["avg_delivered_bitrate_mbps"],
        "bitrate_switches": qoe["bitrate_switches"],
        "mean_switch_magnitude_mbps": qoe["mean_switch_magnitude_mbps"],
        "qoe": qoe["score"],
        "session_time_s": round(end_t, 3),
        "mean_download_s": round(sum(d.duration_s for d in deliveries) / n_seg, 4),
        "mean_throughput_mbps": round(sum(s["throughput_mbps"] for s in segments) / n_seg, 4),
        "delivered_mb": round(total_bytes / 1e6, 4),
        "mean_buffer_s": round(buf.average_level(), 3),
        "packets_sent": sum(d.packets_sent for d in deliveries),
        "packets_lost": sum(d.packets_lost for d in deliveries),
        "retransmissions": sum(d.retransmissions for d in deliveries),
        "fast_retransmits": sum(d.fast_retransmits for d in deliveries),
        "timeouts": sum(d.timeouts for d in deliveries),
        "hol_blocked_packet_s": round(sum(d.hol_blocked_packet_s for d in deliveries), 4),
        "hol_blocked_packets": sum(d.hol_blocked_packets for d in deliveries),
        "reordered_packets": sum(d.reordered_packets for d in deliveries),
        "late_packets": sum(d.late_packets for d in deliveries),
        "incomplete_segments": sum(1 for d in deliveries if d.delivered_fraction < 1.0),
        "mean_delivered_fraction": round(sum(d.delivered_fraction for d in deliveries) / n_seg, 5),
    }

    return SessionResult({
        "config": cfg.to_dict(),
        "transport_label": transport.label,
        "metrics": metrics,
        "qoe": qoe,
        "segments": segments,
        "events": events,
        "timeline": build_timeline(net, buf, segments, end_t, v.segment_s, v.ladder_mbps),
        "stalls": [{"start": round(s, 4), "end": round(e, 4)} for s, e in buf.stalls],
        "packet_trace": packet_trace,
        "note": MODEL_NOTE,
    })


def build_timeline(
    net: NetworkModel, buf: PlaybackBuffer, segments: list[dict[str, Any]],
    end_t: float, segment_s: float, ladder: list[float], step_s: float = 0.5,
) -> list[dict[str, Any]]:
    """Time grid of network + playback state, all derived from the simulation run."""
    rows: list[dict[str, Any]] = []
    n = int(end_t / step_s) + 1
    for k in range(n + 1):
        t = min(k * step_s, end_t)
        level, played, state = buf.sample(t)
        seg_idx = min(int(played / segment_s + 1e-9), len(segments) - 1)
        downloading = any(s["t_request"] <= t < s["t_complete"] for s in segments)
        c = net.conditions_at(t)
        rows.append({
            "t": round(t, 3),
            "bandwidth_mbps": round(c.bandwidth_mbps, 4),
            "rtt_ms": round(c.latency_ms, 2),
            "loss_percent": round(c.packet_loss_percent, 4),
            "buffer_s": round(level, 3),
            "played_s": round(played, 3),
            "state": state,
            "playing_bitrate_mbps": segments[seg_idx]["bitrate_mbps"] if state != "startup" else 0.0,
            "downloading": downloading,
        })
        if t >= end_t:
            break
    return rows


def run_experiment(config: dict | SimulationConfig) -> dict[str, Any]:
    """Convenience wrapper: dict/config in, plain-dict result out."""
    cfg = config if isinstance(config, SimulationConfig) else SimulationConfig.from_dict(config)
    return run_session(cfg).to_dict()
