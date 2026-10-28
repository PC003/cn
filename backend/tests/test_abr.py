import pytest

from app.simulation.abr import BufferAbr, ThroughputAbr, harmonic_mean, make_abr
from app.simulation.config import AbrConfig, ConfigError

LADDER = [0.5, 1.0, 2.0, 4.0]


def thr(**kw):
    return ThroughputAbr(AbrConfig(strategy="throughput", **kw), LADDER, 30.0)


def buf(**kw):
    return BufferAbr(AbrConfig(strategy="buffer", **kw), LADDER, 30.0)


def test_harmonic_mean_is_conservative():
    assert harmonic_mean([1.0, 4.0]) == pytest.approx(1.6)
    assert harmonic_mean([2.0, 2.0]) == pytest.approx(2.0)


def test_first_segment_uses_initial_level():
    d = thr(initial_level=1).decide(0, 0.0)
    assert d.level == 1 and d.rule == "startup-initial"
    assert buf().decide(0, 0.0).level == 0


def test_throughput_picks_highest_rung_within_safety():
    a = thr(safety_factor=0.8, estimator_window=3)
    for _ in range(3):
        a.observe(3.0)
    d = a.decide(1, 10.0)
    assert d.safe_mbps == pytest.approx(2.4)
    assert d.level == 2 and d.bitrate_mbps == 2.0
    assert d.estimate_mbps == pytest.approx(3.0)


def test_throughput_floor_and_ladder_cap():
    a = thr()
    a.observe(0.1)
    assert a.decide(1, 5.0).level == 0
    assert a.decide(1, 5.0).rule == "throughput-floor"
    b = thr()
    b.observe(500.0)
    d = b.decide(1, 5.0)
    assert d.level == len(LADDER) - 1  # never above the ladder


def test_throughput_window_uses_recent_samples_only():
    a = thr(estimator_window=2, safety_factor=1.0)
    for v in (0.1, 0.1, 4.0, 4.0):
        a.observe(v)
    assert a.decide(4, 5.0).level == 3


def test_buffer_abr_reservoir_cushion_and_hysteresis():
    a = buf(reservoir_s=5, cushion_s=10)
    a.decide(0, 0.0)  # initial, level 0
    assert a.decide(1, 2.0).rule == "buffer-reservoir"
    d = a.decide(2, 15.0)  # >= reservoir + cushion
    assert d.level == 3 and d.rule == "buffer-cushion-full"
    # mid-range: f(B) between rungs keeps previous (hysteresis)
    a2 = buf(reservoir_s=5, cushion_s=10)
    a2.last_level = 1
    d2 = a2.decide(3, 8.0)  # f = 0.5 + 3.5*(3/10)=1.55 -> between 1.0 and 2.0
    assert d2.level == 1 and d2.rule == "buffer-hold"
    d3 = a2.decide(4, 11.0)  # f = 0.5+3.5*0.6=2.6 >= next rung 2.0 -> up
    assert d3.level == 2 and d3.rule == "buffer-map-up"
    d4 = a2.decide(5, 6.0)  # f = 0.5+3.5*0.1=0.85 <= lower rung (1.0) -> down
    assert d4.level < 2 and d4.rule == "buffer-map-down"


def test_decisions_carry_reason():
    a = thr()
    a.observe(2.0)
    d = a.decide(1, 3.0).to_dict()
    assert d["reason"] and d["rule"] and d["buffer_s"] == 3.0


def test_make_abr_validation():
    with pytest.raises(ConfigError):
        make_abr(AbrConfig(strategy="throughput", initial_level=7), LADDER, 30.0)
