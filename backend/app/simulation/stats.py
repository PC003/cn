"""
Statistical helpers (no SciPy dependency) and the Mathis throughput model.

Confidence intervals use Student's t-distribution with n-1 degrees of freedom:

    mean +/- t_{0.975, n-1} * s / sqrt(n)

which assumes the per-seed metric values are independent and roughly normal.
With ~30 seeds the central limit theorem makes this reasonable for means, but
heavily skewed metrics (e.g. rebuffering time, which is zero for most seeds)
violate the assumption and the interval should be read with care.
"""

from __future__ import annotations

import math
from typing import Iterable, Optional

# Two-sided 95% critical values of Student's t, by degrees of freedom.
_T975 = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306,
    9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
    16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074,
    23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045,
    30: 2.042, 40: 2.021, 60: 2.000, 120: 1.980,
}
_Z975 = 1.960


def t_critical_95(df: int) -> float:
    """Two-sided 95% t critical value (table with interpolation in 1/df)."""
    if df < 1:
        raise ValueError("degrees of freedom must be >= 1")
    if df in _T975:
        return _T975[df]
    keys = sorted(_T975)
    if df > keys[-1]:
        # interpolate between df=120 and infinity in 1/df
        w = (1.0 / df) / (1.0 / keys[-1])
        return _Z975 + w * (_T975[keys[-1]] - _Z975)
    lo = max(k for k in keys if k < df)
    hi = min(k for k in keys if k > df)
    w = (1.0 / df - 1.0 / hi) / (1.0 / lo - 1.0 / hi)
    return _T975[hi] + w * (_T975[lo] - _T975[hi])


def mean(values: list[float]) -> float:
    if not values:
        raise ValueError("mean of an empty sample")
    return sum(values) / len(values)


def sample_std(values: list[float]) -> float:
    """Sample (n-1) standard deviation; 0.0 for a single observation."""
    n = len(values)
    if n < 2:
        return 0.0
    m = mean(values)
    return math.sqrt(sum((v - m) ** 2 for v in values) / (n - 1))


def summarize(values: Iterable[Optional[float]]) -> dict:
    """Mean, std, 95% t-interval, min/max and counts. None/NaN values are excluded."""
    raw = list(values)
    clean = [float(v) for v in raw if v is not None and not (isinstance(v, float) and math.isnan(v))]
    excluded = len(raw) - len(clean)
    n = len(clean)
    if n == 0:
        return {"n": 0, "excluded": excluded, "mean": None, "std": None, "ci_low": None,
                "ci_high": None, "ci_half_width": None, "min": None, "max": None}
    m = mean(clean)
    s = sample_std(clean)
    if n >= 2:
        half = t_critical_95(n - 1) * s / math.sqrt(n)
    else:
        half = None
    return {
        "n": n, "excluded": excluded, "mean": m, "std": s,
        "ci_low": None if half is None else m - half,
        "ci_high": None if half is None else m + half,
        "ci_half_width": half, "min": min(clean), "max": max(clean),
    }


# ----------------------------------------------------------------------- Mathis
MATHIS_C = 1.22  # sqrt(3/2) ~ 1.2247 for periodic loss, ack-every-packet


def mathis_throughput_mbps(mss_bytes: float, rtt_s: float, loss_probability: float,
                           c: float = MATHIS_C) -> float:
    """
    Mathis et al. (1997) steady-state TCP throughput bound.

        T = (MSS / RTT) * C / sqrt(p)        [bytes/s]  ->  x 8 / 1e6 = Mbps

    ``mss_bytes`` is the TCP payload per packet (NOT the video-segment size).
    Undefined for p = 0 (the formula diverges), so that case raises.
    """
    if loss_probability <= 0:
        raise ValueError("Mathis formula is undefined for zero loss probability")
    if rtt_s <= 0 or mss_bytes <= 0:
        raise ValueError("MSS and RTT must be positive")
    return (mss_bytes / rtt_s) * c / math.sqrt(loss_probability) * 8.0 / 1e6
