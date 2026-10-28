"""
Adaptive bitrate (ABR) controllers.

Two strategies, both logging *why* each decision was made:

Throughput-based
    estimate = harmonic mean of the last ``estimator_window`` measured segment
    throughputs (the harmonic mean is dominated by slow samples, so it is
    conservative);  safe = estimate x safety_factor;  choose the highest ladder
    rung with bitrate <= safe, or the lowest rung when nothing fits.

Buffer-based (BBA-0 style, Huang et al. 2014, simplified)
    A piece-wise linear map ``f(B)`` from buffer occupancy to a target bitrate:
    lowest rung when ``B <= reservoir``, highest when ``B >= reservoir +
    cushion``, linear in between. The previous rung is kept unless ``f(B)``
    crosses the next-higher / next-lower rung (hysteresis), so quality rises
    cautiously and does not oscillate. This is an educational simplification,
    not Netflix's production algorithm.

The first segment always uses ``initial_level`` because there is neither a
throughput sample nor a buffer to reason about.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.simulation.config import AbrConfig, ConfigError


@dataclass
class AbrDecision:
    segment: int
    level: int
    bitrate_mbps: float
    strategy: str
    rule: str
    reason: str
    previous_level: Optional[int]
    buffer_s: float
    estimate_mbps: Optional[float]
    safe_mbps: Optional[float]

    def to_dict(self) -> dict:
        return {
            "segment": self.segment,
            "level": self.level,
            "bitrate_mbps": self.bitrate_mbps,
            "strategy": self.strategy,
            "rule": self.rule,
            "reason": self.reason,
            "previous_level": self.previous_level,
            "buffer_s": round(self.buffer_s, 3),
            "estimate_mbps": None if self.estimate_mbps is None else round(self.estimate_mbps, 4),
            "safe_mbps": None if self.safe_mbps is None else round(self.safe_mbps, 4),
        }


def harmonic_mean(values: list[float]) -> float:
    if not values:
        raise ValueError("harmonic mean of an empty sample")
    if any(v <= 0 for v in values):
        return 0.0
    return len(values) / sum(1.0 / v for v in values)


class AbrController:
    strategy = "abstract"

    def __init__(self, cfg: AbrConfig, ladder_mbps: list[float], max_buffer_s: float):
        if cfg.initial_level >= len(ladder_mbps):
            raise ConfigError("initial_level is above the bitrate ladder")
        self.cfg = cfg
        self.ladder = list(ladder_mbps)
        self.max_buffer_s = max_buffer_s
        self.samples: list[float] = []
        self.last_level: Optional[int] = None

    def observe(self, throughput_mbps: float) -> None:
        self.samples.append(max(0.0, throughput_mbps))

    def estimate(self) -> Optional[float]:
        if not self.samples:
            return None
        return harmonic_mean(self.samples[-self.cfg.estimator_window:])

    def _finish(self, d: AbrDecision) -> AbrDecision:
        self.last_level = d.level
        return d

    def _initial(self, segment: int, buffer_s: float) -> AbrDecision:
        lvl = self.cfg.initial_level
        return self._finish(AbrDecision(
            segment, lvl, self.ladder[lvl], self.strategy, "startup-initial",
            f"no throughput sample yet: start at configured initial level {lvl} "
            f"({self.ladder[lvl]:g} Mbps)", None, buffer_s, None, None))

    def decide(self, segment: int, buffer_s: float) -> AbrDecision:
        raise NotImplementedError


class ThroughputAbr(AbrController):
    strategy = "throughput"

    def decide(self, segment: int, buffer_s: float) -> AbrDecision:
        est = self.estimate()
        if est is None:
            return self._initial(segment, buffer_s)
        safe = est * self.cfg.safety_factor
        fits = [i for i, r in enumerate(self.ladder) if r <= safe + 1e-12]
        if fits:
            lvl = fits[-1]
            rule = "throughput-fit"
            reason = (f"estimate {est:.2f} Mbps x safety {self.cfg.safety_factor:g} = "
                      f"{safe:.2f} Mbps; highest rung <= that is {self.ladder[lvl]:g} Mbps")
            if lvl == len(self.ladder) - 1 and safe > self.ladder[-1]:
                rule = "throughput-cap"
                reason += " (top of ladder)"
        else:
            lvl = 0
            rule = "throughput-floor"
            reason = (f"safe throughput {safe:.2f} Mbps is below the lowest rung "
                      f"({self.ladder[0]:g} Mbps): using the lowest rung")
        return self._finish(AbrDecision(segment, lvl, self.ladder[lvl], self.strategy, rule, reason,
                                        self.last_level, buffer_s, est, safe))


class BufferAbr(AbrController):
    strategy = "buffer"

    def target_rate(self, buffer_s: float) -> float:
        r, c = self.cfg.reservoir_s, self.cfg.cushion_s
        lo, hi = self.ladder[0], self.ladder[-1]
        if buffer_s <= r:
            return lo
        if buffer_s >= r + c:
            return hi
        return lo + (hi - lo) * (buffer_s - r) / c

    def decide(self, segment: int, buffer_s: float) -> AbrDecision:
        est = self.estimate()
        if self.last_level is None:
            return self._initial(segment, buffer_s)
        prev = self.last_level
        top = len(self.ladder) - 1
        r, c = self.cfg.reservoir_s, self.cfg.cushion_s
        f = self.target_rate(buffer_s)
        if buffer_s <= r:
            lvl, rule = 0, "buffer-reservoir"
            reason = f"buffer {buffer_s:.1f}s <= reservoir {r:g}s: lowest rung to protect playback"
        elif buffer_s >= r + c:
            lvl, rule = top, "buffer-cushion-full"
            reason = f"buffer {buffer_s:.1f}s >= reservoir+cushion {r + c:g}s: highest rung"
        else:
            r_plus = self.ladder[min(prev + 1, top)]
            r_minus = self.ladder[max(prev - 1, 0)]
            if prev < top and f >= r_plus:
                lvl = max(i for i, x in enumerate(self.ladder) if x <= f + 1e-12)
                rule = "buffer-map-up"
                reason = (f"map f(B={buffer_s:.1f}s) = {f:.2f} Mbps >= next rung "
                          f"{r_plus:g}: step up to {self.ladder[lvl]:g} Mbps")
            elif prev > 0 and f <= r_minus:
                lvl = min(i for i, x in enumerate(self.ladder) if x >= f - 1e-12)
                rule = "buffer-map-down"
                reason = (f"map f(B={buffer_s:.1f}s) = {f:.2f} Mbps <= lower rung "
                          f"{r_minus:g}: step down to {self.ladder[lvl]:g} Mbps")
            else:
                lvl, rule = prev, "buffer-hold"
                reason = (f"map f(B={buffer_s:.1f}s) = {f:.2f} Mbps lies between rungs "
                          f"{r_minus:g} and {r_plus:g}: keep {self.ladder[prev]:g} Mbps (hysteresis)")
        return self._finish(AbrDecision(segment, lvl, self.ladder[lvl], self.strategy, rule, reason,
                                        prev, buffer_s, est, None))


def make_abr(cfg: AbrConfig, ladder_mbps: list[float], max_buffer_s: float) -> AbrController:
    if cfg.strategy == "throughput":
        return ThroughputAbr(cfg, ladder_mbps, max_buffer_s)
    if cfg.strategy == "buffer":
        return BufferAbr(cfg, ladder_mbps, max_buffer_s)
    raise ConfigError(f"unknown ABR strategy '{cfg.strategy}'")


def choose_representation(
    ctrl: AbrController, segment: int, buffer_s: float
) -> AbrDecision:
    """Functional wrapper kept for the original module interface."""
    return ctrl.decide(segment, buffer_s)
