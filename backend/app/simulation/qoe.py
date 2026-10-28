"""
Simplified, transparent Quality-of-Experience score.

This is an *educational, linear* score in the spirit of the model of Yin et al.
(SIGCOMM 2015) but normalised to 0-100. **It is not an industry-standard
measurement** (not ITU-T P.1203, not Netflix's VMAF-based internal metrics).

Perceived quality of a bitrate R is a concave (diminishing-returns) utility

    U(R) = ln(1 + R/R_min) / ln(1 + R_max/R_min)          in (0, 1]

with R_min / R_max the lowest / highest ladder rungs. With u_k = U(bitrate_k)*q_k
for segment k, where q_k in [0, 1] is the delivered-quality factor (1 for fully
delivered, lower for damaged or dropped UDP segments):

    quality   = 100 * (duration-weighted mean of u_k)
    rebuffer  = w_ratio * rebuffer_ratio_pct + w_event * n_stalls
                with rebuffer_ratio = stall_time / (content_time + stall_time)
    startup   = min(startup_cap, w_startup * startup_delay_s)
    switching = w_switch * 100 * mean_k |U(b_{k+1}) - U(b_k)|
    QoE       = clamp(quality - rebuffer - startup - switching, 0, 100)

Every component is reported; the weights live in :class:`QoEConfig`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from app.simulation.config import QoEConfig


@dataclass
class SegmentPlayback:
    bitrate_mbps: float
    duration_s: float
    quality_factor: float = 1.0


def quality_utility(bitrate_mbps: float, ladder_min_mbps: float, ladder_max_mbps: float) -> float:
    """Concave utility of a bitrate, 1.0 at the top rung (see module docstring)."""
    return math.log(1.0 + bitrate_mbps / ladder_min_mbps) / math.log(1.0 + ladder_max_mbps / ladder_min_mbps)


def compute_qoe(
    segments: list[SegmentPlayback],
    ladder_min_mbps: float,
    ladder_max_mbps: float,
    startup_delay_s: Optional[float],
    rebuffer_s: float,
    rebuffer_events: int,
    cfg: Optional[QoEConfig] = None,
) -> dict:
    cfg = cfg or QoEConfig()
    if not segments:
        raise ValueError("QoE needs at least one played segment")
    if ladder_min_mbps <= 0 or ladder_max_mbps < ladder_min_mbps:
        raise ValueError("ladder bounds must satisfy 0 < min <= max")
    content_s = sum(s.duration_s for s in segments)
    startup = float(startup_delay_s) if startup_delay_s is not None else 0.0

    wsum = sum(s.duration_s for s in segments)
    mean_nominal = sum(s.bitrate_mbps * s.duration_s for s in segments) / wsum
    mean_delivered = sum(s.bitrate_mbps * s.quality_factor * s.duration_s for s in segments) / wsum
    util = [quality_utility(s.bitrate_mbps, ladder_min_mbps, ladder_max_mbps) for s in segments]
    mean_u = sum(u * s.quality_factor * s.duration_s for u, s in zip(util, segments)) / wsum
    quality = 100.0 * mean_u

    session_s = content_s + rebuffer_s
    ratio = rebuffer_s / session_s if session_s > 0 else 0.0
    rebuffer_penalty = cfg.rebuffer_ratio_penalty_per_pct * (100.0 * ratio) \
        + cfg.rebuffer_event_penalty * rebuffer_events

    startup_penalty = min(cfg.startup_penalty_cap, cfg.startup_penalty_per_s * startup)

    diffs = [abs(ub - ua) for ua, ub in zip(util, util[1:])]
    switches = sum(1 for a, b in zip(segments, segments[1:]) if a.bitrate_mbps != b.bitrate_mbps)
    mean_change = (sum(diffs) / len(diffs)) if diffs else 0.0
    switch_penalty = cfg.switch_penalty_weight * 100.0 * mean_change

    raw = quality - rebuffer_penalty - startup_penalty - switch_penalty
    score = max(0.0, min(100.0, raw))
    return {
        "score": round(score, 3),
        "raw_score": round(raw, 3),
        "quality_term": round(quality, 3),
        "rebuffer_penalty": round(rebuffer_penalty, 3),
        "startup_penalty": round(startup_penalty, 3),
        "switch_penalty": round(switch_penalty, 3),
        "avg_bitrate_mbps": round(mean_nominal, 4),
        "avg_delivered_bitrate_mbps": round(mean_delivered, 4),
        "startup_delay_s": round(startup, 4),
        "rebuffer_s": round(rebuffer_s, 4),
        "rebuffer_events": rebuffer_events,
        "rebuffer_ratio": round(ratio, 5),
        "bitrate_switches": switches,
        "mean_switch_magnitude_mbps": round(
            (sum(abs(b.bitrate_mbps - a.bitrate_mbps) for a, b in zip(segments, segments[1:]))
             / len(diffs)) if diffs else 0.0, 4),
        "mean_switch_magnitude_utility": round(mean_change, 5),
        "weights": {
            "rebuffer_ratio_penalty_per_pct": cfg.rebuffer_ratio_penalty_per_pct,
            "rebuffer_event_penalty": cfg.rebuffer_event_penalty,
            "startup_penalty_per_s": cfg.startup_penalty_per_s,
            "startup_penalty_cap": cfg.startup_penalty_cap,
            "switch_penalty_weight": cfg.switch_penalty_weight,
        },
    }
