"""
Network-condition generation.

A ``NetworkModel`` turns a :class:`NetworkConfig` and a seed into everything
the transports need to know about the path:

* a piecewise-constant bandwidth trace (constant, seeded log-space random walk,
  or user supplied time-stepped values) with optional impairment windows
  (bandwidth drop, loss spike, latency spike) layered on top,
* loss probability and RTT as functions of time,
* deterministic random draws keyed by ``(seed, stream, segment, attempt)``.

The last point is what makes protocol comparisons *controlled*: the first
transmission of packet ``i`` of segment ``s`` sees the same loss draw whether
it is carried by the TCP-like, UDP-like or QUIC-like model, and the bandwidth
trace is generated from the seed alone, so only transport behaviour differs.

Units: bandwidth in Mbps (1 Mbit = 1e6 bit), times in seconds.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import numpy as np

from app.simulation.config import NetworkConfig

# Independent random streams (second element of the SeedSequence key).
STREAM_TRACE = 0
STREAM_LOSS = 1
STREAM_JITTER = 2
STREAM_HANDSHAKE = 3


@dataclass
class NetworkConditions:
    bandwidth_mbps: float
    latency_ms: float
    jitter_ms: float
    packet_loss_percent: float


class NetworkModel:
    def __init__(self, cfg: NetworkConfig, seed: int, horizon_s: float = 1000.0):
        cfg.validate()
        self.cfg = cfg
        self.seed = int(seed)
        self.horizon_s = max(float(horizon_s), 10.0)
        base_times, base_rates = self._base_trace()
        self.times, self.rates = self._apply_impairments(base_times, base_rates)
        self.base_loss = cfg.loss_probability
        self.base_rtt_s = cfg.rtt_ms / 1000.0
        self.jitter_s = cfg.jitter_ms / 1000.0

    # ------------------------------------------------------------ trace building
    def _base_trace(self) -> tuple[np.ndarray, np.ndarray]:
        cfg = self.cfg
        if cfg.profile == "constant":
            return np.array([0.0]), np.array([cfg.bandwidth_mbps])

        if cfg.profile == "steps":
            pts = sorted(cfg.steps)
            times = np.array([t for t, _ in pts], dtype=float)
            rates = np.array([r for _, r in pts], dtype=float)
            if times[0] > 0:  # before the first step, hold the first value
                times = np.concatenate([[0.0], times])
                rates = np.concatenate([[rates[0]], rates])
            return times, rates

        # random_walk: mean-reverting random walk in log space (seeded).
        rng = np.random.default_rng([self.seed, STREAM_TRACE])
        n = int(math.ceil(self.horizon_s / cfg.trace_interval_s)) + 1
        hi = cfg.max_bandwidth_mbps if cfg.max_bandwidth_mbps else 3.0 * cfg.bandwidth_mbps
        lo = cfg.min_bandwidth_mbps
        log_mean = math.log(cfg.bandwidth_mbps)
        theta = 0.15  # pull towards the configured mean each step
        x = log_mean
        rates = np.empty(n)
        noise = rng.normal(0.0, cfg.variability, size=n)
        for i in range(n):
            rates[i] = min(hi, max(lo, math.exp(x)))
            x += theta * (log_mean - x) + noise[i]
        times = np.arange(n, dtype=float) * cfg.trace_interval_s
        return times, rates

    def _apply_impairments(
        self, times: np.ndarray, rates: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray]:
        imps = self.cfg.impairments
        if not imps:
            return times, rates
        pts = set(float(t) for t in times)
        for imp in imps:
            pts.add(imp.start_s)
            pts.add(imp.start_s + imp.duration_s)
        new_times = np.array(sorted(pts))
        idx = np.searchsorted(times, new_times, side="right") - 1
        new_rates = rates[np.clip(idx, 0, len(rates) - 1)].astype(float).copy()
        for imp in imps:
            active = (new_times >= imp.start_s) & (new_times < imp.start_s + imp.duration_s)
            new_rates[active] *= imp.bandwidth_scale
        return new_times, new_rates

    # ------------------------------------------------------------------- queries
    def rate_mbps_at(self, t: float) -> float:
        i = int(np.searchsorted(self.times, t, side="right")) - 1
        return float(self.rates[max(i, 0)])

    def rates_at(self, ts: np.ndarray) -> np.ndarray:
        idx = np.searchsorted(self.times, ts, side="right") - 1
        return self.rates[np.clip(idx, 0, len(self.rates) - 1)]

    def transfer_time(self, t0: float, bits: float) -> float:
        """Seconds needed to serialise ``bits`` starting at ``t0`` (integrates the trace)."""
        if bits <= 0:
            return 0.0
        i = max(int(np.searchsorted(self.times, t0, side="right")) - 1, 0)
        n = len(self.times)
        t = t0
        remaining = bits
        while True:
            rate = float(self.rates[i]) * 1e6
            end = float(self.times[i + 1]) if i + 1 < n else math.inf
            cap = rate * (end - t)
            if remaining <= cap:
                return t + remaining / rate - t0
            remaining -= cap
            t = end
            i += 1

    def loss_at(self, t: float) -> float:
        p = self.base_loss
        for imp in self.cfg.impairments:
            if imp.start_s <= t < imp.start_s + imp.duration_s:
                p += imp.extra_loss
        return min(p, 0.99)

    def loss_at_many(self, ts: np.ndarray) -> np.ndarray:
        p = np.full(ts.shape, self.base_loss, dtype=float)
        for imp in self.cfg.impairments:
            p += np.where(
                (ts >= imp.start_s) & (ts < imp.start_s + imp.duration_s), imp.extra_loss, 0.0
            )
        return np.minimum(p, 0.99)

    def rtt_s_at(self, t: float) -> float:
        extra = 0.0
        for imp in self.cfg.impairments:
            if imp.start_s <= t < imp.start_s + imp.duration_s:
                extra += imp.extra_rtt_ms
        return self.base_rtt_s + extra / 1000.0

    def conditions_at(self, t: float) -> NetworkConditions:
        return NetworkConditions(
            bandwidth_mbps=self.rate_mbps_at(t),
            latency_ms=self.rtt_s_at(t) * 1000.0,
            jitter_ms=self.cfg.jitter_ms,
            packet_loss_percent=self.loss_at(t) * 100.0,
        )

    # --------------------------------------------------------- deterministic draws
    def uniform_draws(self, stream: int, segment: int, attempt: int, n: int) -> np.ndarray:
        rng = np.random.default_rng([self.seed, stream, int(segment), int(attempt)])
        return rng.random(n)

    def normal_draws(self, stream: int, segment: int, attempt: int, n: int) -> np.ndarray:
        rng = np.random.default_rng([self.seed, stream, int(segment), int(attempt)])
        return rng.standard_normal(n)

    def timeline(self, t_end: float, step_s: float = 1.0) -> list[dict]:
        """Sampled network conditions for charts (actual model values, not smoothed)."""
        out = []
        t = 0.0
        while t <= t_end + 1e-9:
            c = self.conditions_at(t)
            out.append({
                "t": round(t, 3),
                "bandwidth_mbps": round(c.bandwidth_mbps, 4),
                "rtt_ms": round(c.latency_ms, 3),
                "loss_percent": round(c.packet_loss_percent, 4),
            })
            t += step_s
        return out


def sample_conditions(
    time_s: float, seed: int, config: Optional[NetworkConfig] = None
) -> NetworkConditions:
    """Network conditions at ``time_s`` for ``seed`` (default configuration if none given)."""
    return NetworkModel(config or NetworkConfig(), seed).conditions_at(time_s)
