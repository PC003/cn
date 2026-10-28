"""
Experiment orchestration: controlled comparisons, repeated trials, sweeps,
sensitivity analysis and the Mathis validation.

Every function takes a ``SimulationConfig`` (or dict) and returns plain,
JSON-serialisable data computed from simulator runs - nothing is hard-coded.
"""

from __future__ import annotations

import copy
import math
from typing import Any, Iterable, Optional, Sequence

from app.simulation.config import (
    NETWORK_PRESETS,
    ConfigError,
    NetworkConfig,
    SimulationConfig,
    TransportConfig,
)
from app.simulation.experiment import run_session
from app.simulation.network import NetworkModel
from app.simulation.stats import mathis_throughput_mbps, summarize
from app.simulation.tcp_model import TcpLikeTransport
from app.simulation.transport import SimulationError

MAX_TRIALS = 100
SCALAR_METRICS = [
    "qoe", "avg_bitrate_mbps", "avg_delivered_bitrate_mbps", "startup_delay_s", "rebuffer_s",
    "rebuffer_events", "rebuffer_ratio", "bitrate_switches", "mean_throughput_mbps",
    "mean_download_s", "retransmissions", "timeouts", "fast_retransmits", "packets_lost",
    "hol_blocked_packet_s", "reordered_packets", "incomplete_segments", "mean_delivered_fraction",
    "mean_buffer_s", "session_time_s",
]


def as_config(config: SimulationConfig | dict | None) -> SimulationConfig:
    if isinstance(config, SimulationConfig):
        return config.validate()
    return SimulationConfig.from_dict(config or {})


def apply_preset(cfg: SimulationConfig, name: str) -> SimulationConfig:
    if name not in NETWORK_PRESETS:
        raise ConfigError(f"unknown network preset '{name}'")
    d = cfg.to_dict()
    net = NetworkConfig()
    base = net.__dict__.copy()
    base.update(copy.deepcopy(NETWORK_PRESETS[name]))
    d["network"] = {**d["network"], **base}
    return SimulationConfig.from_dict(d)


def _check_trials(n: int) -> int:
    if not isinstance(n, int) or n < 1 or n > MAX_TRIALS:
        raise ConfigError(f"n_trials must be an integer in [1, {MAX_TRIALS}]")
    return n


# ----------------------------------------------------------------- single protocol
def run_trials(
    config: SimulationConfig | dict, n_trials: int = 30, base_seed: Optional[int] = None
) -> dict[str, Any]:
    """Run ``n_trials`` independent seeds of one configuration and aggregate."""
    cfg = as_config(config)
    _check_trials(n_trials)
    seed0 = cfg.seed if base_seed is None else base_seed
    rows: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    for i in range(n_trials):
        seed = seed0 + i
        try:
            m = run_session(cfg.replace(seed=seed)).data["metrics"]
        except (SimulationError, ConfigError) as exc:  # excluded runs are reported, not hidden
            excluded.append({"seed": seed, "reason": str(exc)})
            continue
        rows.append({"seed": seed, **{k: m[k] for k in SCALAR_METRICS}})
    summary = {k: summarize(r[k] for r in rows) for k in SCALAR_METRICS}
    return {
        "protocol": cfg.transport.protocol,
        "abr": cfg.abr.strategy,
        "n_requested": n_trials,
        "n_ok": len(rows),
        "excluded": excluded,
        "base_seed": seed0,
        "ci_method": "Student t, 95% two-sided, df = n-1 (assumes independent, roughly normal means)",
        "summary": summary,
        "per_trial": rows,
    }


# --------------------------------------------------------------- transport compare
def compare_transports(
    config: SimulationConfig | dict,
    protocols: Sequence[str] = ("tcp", "udp", "quic"),
    udp_recoveries: Optional[Sequence[str]] = None,
) -> dict[str, Any]:
    """
    Same network trace, loss draws, jitter, ladder, ABR and seed; only the
    transport differs. ``udp_recoveries`` adds one UDP variant per policy.
    """
    cfg = as_config(config)
    runs: list[dict[str, Any]] = []
    variants: list[tuple[str, SimulationConfig]] = []
    for p in protocols:
        if p == "udp" and udp_recoveries:
            for rec in udp_recoveries:
                c = cfg.with_value("transport.protocol", "udp").with_value("transport.udp_recovery", rec)
                variants.append((f"udp ({rec})", c))
        else:
            variants.append((p, cfg.with_value("transport.protocol", p)))
    for label, c in variants:
        res = run_session(c).data
        runs.append({"label": label, "protocol": c.transport.protocol, "result": res})
    return {"seed": cfg.seed, "runs": runs, "same_conditions": _same_conditions_note(cfg)}


def _same_conditions_note(cfg: SimulationConfig) -> dict[str, Any]:
    n, v = cfg.network, cfg.video
    return {
        "seed": cfg.seed, "profile": n.profile, "bandwidth_mbps": n.bandwidth_mbps,
        "rtt_ms": n.rtt_ms, "jitter_ms": n.jitter_ms, "loss_probability": n.loss_probability,
        "ladder_mbps": v.ladder_mbps, "segment_s": v.segment_s, "abr": cfg.abr.strategy,
    }


def compare_transports_trials(
    config: SimulationConfig | dict,
    n_trials: int = 30,
    protocols: Sequence[str] = ("tcp", "udp", "quic"),
    udp_recoveries: Optional[Sequence[str]] = None,
) -> dict[str, Any]:
    """Repeated-seed version of :func:`compare_transports` with 95% CIs per variant."""
    cfg = as_config(config)
    out = []
    variants: list[tuple[str, SimulationConfig]] = []
    for p in protocols:
        if p == "udp" and udp_recoveries:
            for rec in udp_recoveries:
                variants.append((f"udp ({rec})", cfg.with_value("transport.protocol", "udp")
                                 .with_value("transport.udp_recovery", rec)))
        else:
            variants.append((p, cfg.with_value("transport.protocol", p)))
    for label, c in variants:
        t = run_trials(c, n_trials)
        t["label"] = label
        out.append(t)
    return {"n_trials": n_trials, "base_seed": cfg.seed, "variants": out}


# ------------------------------------------------------------------ ABR comparison
def compare_abr(
    config: SimulationConfig | dict, strategies: Sequence[str] = ("throughput", "buffer"),
    n_trials: int = 1,
) -> dict[str, Any]:
    cfg = as_config(config)
    out = []
    for s in strategies:
        c = cfg.with_value("abr.strategy", s)
        if n_trials == 1:
            out.append({"strategy": s, "result": run_session(c).data})
        else:
            out.append({"strategy": s, "trials": run_trials(c, n_trials)})
    return {"seed": cfg.seed, "n_trials": n_trials, "runs": out}


# ------------------------------------------------------------------- sensitivity
SENSITIVITY_PARAMETERS = {
    "abr.safety_factor": "ABR safety factor",
    "abr.reservoir_s": "Buffer-based reservoir (s)",
    "abr.cushion_s": "Buffer-based cushion (s)",
    "video.segment_s": "Segment duration (s)",
    "video.max_buffer_s": "Maximum playback buffer (s)",
    "network.loss_probability": "Packet loss probability",
    "network.rtt_ms": "RTT (ms)",
    "network.variability": "Bandwidth variability (log-step std)",
    "network.bandwidth_mbps": "Mean bandwidth (Mbps)",
    "network.jitter_ms": "Jitter (ms)",
}


def sensitivity(
    config: SimulationConfig | dict, parameter: str, values: Sequence[float], n_trials: int = 10,
) -> dict[str, Any]:
    cfg = as_config(config)
    _check_trials(n_trials)
    if parameter not in SENSITIVITY_PARAMETERS:
        raise ConfigError(f"parameter must be one of {sorted(SENSITIVITY_PARAMETERS)}")
    if not values or len(values) > 15:
        raise ConfigError("provide between 1 and 15 values")
    points = []
    for v in values:
        try:
            c = cfg.with_value(parameter, float(v))
        except ConfigError as exc:
            points.append({"value": v, "error": str(exc)})
            continue
        t = run_trials(c, n_trials)
        points.append({"value": v, "n_ok": t["n_ok"], "excluded": t["excluded"],
                       "summary": t["summary"]})
    return {
        "parameter": parameter,
        "parameter_label": SENSITIVITY_PARAMETERS[parameter],
        "protocol": cfg.transport.protocol,
        "abr": cfg.abr.strategy,
        "n_trials": n_trials,
        "points": points,
    }


# --------------------------------------------------------------- Mathis validation
def _bulk_packets(p: float, min_packets: int = 5000, max_packets: int = 150_000,
                  target_losses: int = 60) -> int:
    return int(min(max_packets, max(min_packets, target_losses / p)))


def mathis_validation(
    loss_values: Iterable[float] = (0.001, 0.003, 0.01, 0.03),
    rtt_ms_values: Iterable[float] = (20.0, 50.0, 100.0, 200.0),
    n_trials: int = 10,
    bandwidth_mbps: float = 1000.0,
    base_seed: int = 1,
    transport: Optional[TransportConfig] = None,
) -> dict[str, Any]:
    """
    Bulk TCP-like transfer vs the Mathis approximation  T = (MSS/RTT) * 1.22/sqrt(p).

    Throughput is payload bits / transfer time over a large transfer on an
    effectively uncongested path (default 1 Gbit/s) so loss, not capacity,
    limits the window. ``p = 0`` is excluded (formula diverges).
    """
    _check_trials(n_trials)
    tcfg = transport or TransportConfig(protocol="tcp")
    tcfg.validate()
    rows = []
    for rtt_ms in rtt_ms_values:
        for p in loss_values:
            if p <= 0:
                rows.append({"rtt_ms": rtt_ms, "loss_probability": p, "excluded": True,
                             "reason": "p = 0: Mathis formula diverges; excluded from comparison"})
                continue
            n_pkts = _bulk_packets(p)
            size = n_pkts * tcfg.mss_bytes
            samples = []
            for i in range(n_trials):
                net_cfg = NetworkConfig(bandwidth_mbps=bandwidth_mbps, rtt_ms=rtt_ms, jitter_ms=0.0,
                                        loss_probability=p, profile="constant", queue_packets=100_000)
                net = NetworkModel(net_cfg, base_seed + i, horizon_s=100.0)
                tr = TcpLikeTransport(net, tcfg, base_seed + i)
                ready, _ = tr.connect(0.0)
                d = tr.deliver(0, size, ready, 0.0)
                elapsed = d.t_complete - ready
                samples.append(size * 8 / elapsed / 1e6)
            s = summarize(samples)
            theory = mathis_throughput_mbps(tcfg.mss_bytes, rtt_ms / 1000.0, p)
            sim = s["mean"]
            expected_losses = p * n_pkts
            predicted_window = theory * 1e6 / 8 * (rtt_ms / 1000.0) / tcfg.mss_bytes
            warnings = []
            if theory > 0.5 * bandwidth_mbps:
                warnings.append("capacity-limited: Mathis rate approaches link rate")
            if predicted_window > tcfg.rwnd_packets:
                warnings.append(f"receive-window-limited: predicted window {predicted_window:.0f} "
                                f"> rwnd {tcfg.rwnd_packets}")
            if p > 0.02:
                warnings.append("high loss: retransmission timeouts dominate, which Mathis ignores")
            if predicted_window < 15:
                warnings.append(f"small window ({predicted_window:.0f} packets): tail losses and "
                                f"retransmission timeouts (RTO floor) matter, which Mathis ignores")
            rows.append({
                "rtt_ms": rtt_ms, "loss_probability": p, "excluded": False,
                "transfer_packets": n_pkts, "expected_loss_events": expected_losses,
                "simulated_mbps": sim, "simulated_ci_low": s["ci_low"], "simulated_ci_high": s["ci_high"],
                "simulated_std": s["std"], "n": s["n"],
                "mathis_mbps": theory,
                "abs_error_mbps": sim - theory,
                "rel_error": (sim - theory) / theory if theory > 0 else None,
                "predicted_window_packets": predicted_window,
                "regime_ok": not warnings, "warnings": warnings,
            })
    valid = [r for r in rows if not r["excluded"] and r["regime_ok"]]
    mape = (sum(abs(r["rel_error"]) for r in valid) / len(valid)) if valid else None
    return {
        "formula": "T = (MSS / RTT) * 1.22 / sqrt(p)",
        "mss_bytes": tcfg.mss_bytes, "n_trials": n_trials, "bandwidth_mbps": bandwidth_mbps,
        "rows": rows,
        "mean_abs_rel_error_valid_regime": mape,
        "n_valid_regime_points": len(valid),
        "caveats": [
            "Mathis assumes periodic random loss, a fully AIMD (Reno-like) sender, no timeouts, "
            "and an uncongested path with a window large enough to be loss-limited.",
            "MSS is the payload bytes per TCP packet, not the video segment size.",
            "Points flagged with warnings are outside that regime and are not expected to match.",
        ],
    }


def loss_rtt_sweep(
    config: SimulationConfig | dict,
    loss_values: Sequence[float],
    rtt_ms_values: Sequence[float],
    n_trials: int = 5,
    protocols: Sequence[str] = ("tcp", "udp"),
) -> dict[str, Any]:
    """Streaming-level sweep (full sessions) of loss x RTT for the chosen protocols."""
    cfg = as_config(config)
    _check_trials(n_trials)
    if len(loss_values) * len(rtt_ms_values) * len(protocols) > 60:
        raise ConfigError("sweep too large: at most 60 (loss x RTT x protocol) cells")
    cells = []
    for rtt in rtt_ms_values:
        for p in loss_values:
            for proto in protocols:
                c = (cfg.with_value("network.rtt_ms", float(rtt))
                        .with_value("network.loss_probability", float(p))
                        .with_value("transport.protocol", proto))
                t = run_trials(c, n_trials)
                cells.append({"rtt_ms": rtt, "loss_probability": p, "protocol": proto,
                              "n_ok": t["n_ok"], "excluded": t["excluded"], "summary": t["summary"]})
    return {"n_trials": n_trials, "cells": cells}


def pct_diff(a: float, b: float) -> Optional[float]:
    return None if b == 0 or math.isnan(b) else (a - b) / abs(b)
