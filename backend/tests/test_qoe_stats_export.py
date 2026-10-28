import json
import math

import pytest

from app.simulation import export
from app.simulation.config import QoEConfig
from app.simulation.qoe import SegmentPlayback, compute_qoe, quality_utility
from app.simulation.stats import mathis_throughput_mbps, sample_std, summarize, t_critical_95


def segs(rates, qf=1.0):
    return [SegmentPlayback(r, 4.0, qf) for r in rates]


def test_utility_bounds():
    assert quality_utility(6.0, 0.35, 6.0) == pytest.approx(1.0)
    assert 0 < quality_utility(0.35, 0.35, 6.0) < quality_utility(1.5, 0.35, 6.0) < 1.0


def test_perfect_session_scores_100():
    q = compute_qoe(segs([6.0] * 5), 0.35, 6.0, 0.0, 0.0, 0)
    assert q["score"] == pytest.approx(100.0)
    assert q["bitrate_switches"] == 0


def test_penalties_are_applied_with_documented_weights():
    cfg = QoEConfig(rebuffer_ratio_penalty_per_pct=4.0, rebuffer_event_penalty=2.0,
                    startup_penalty_per_s=2.0, startup_penalty_cap=20.0, switch_penalty_weight=0.0)
    # 20 s content, 5 s stall -> ratio 0.2 -> 20% * 4 = 80 ; + 1 event * 2 = 82
    q = compute_qoe(segs([6.0] * 5), 0.35, 6.0, 3.0, 5.0, 1, cfg)
    assert q["rebuffer_penalty"] == pytest.approx(82.0)
    assert q["startup_penalty"] == pytest.approx(6.0)
    assert q["raw_score"] == pytest.approx(100 - 82 - 6)
    assert q["rebuffer_ratio"] == pytest.approx(0.2)


def test_startup_penalty_capped_and_score_clamped():
    q = compute_qoe(segs([0.35] * 3), 0.35, 6.0, 60.0, 100.0, 5)
    assert q["startup_penalty"] == pytest.approx(20.0)
    assert q["score"] == 0.0 and q["raw_score"] < 0


def test_switch_counting_and_penalty():
    q = compute_qoe(segs([0.35, 6.0, 0.35, 6.0]), 0.35, 6.0, 0.0, 0.0, 0)
    assert q["bitrate_switches"] == 3
    assert q["switch_penalty"] > 0
    flat = compute_qoe(segs([3.0] * 4), 0.35, 6.0, 0.0, 0.0, 0)
    assert flat["switch_penalty"] == 0


def test_damaged_segments_reduce_quality_term():
    full = compute_qoe(segs([3.0] * 4), 0.35, 6.0, 0, 0, 0)
    dmg = compute_qoe(segs([3.0] * 4, qf=0.5), 0.35, 6.0, 0, 0, 0)
    assert dmg["quality_term"] == pytest.approx(0.5 * full["quality_term"], abs=1e-3)


def test_qoe_requires_segments():
    with pytest.raises(ValueError):
        compute_qoe([], 0.35, 6.0, 0, 0, 0)


# ------------------------------------------------------------------- statistics
def test_t_critical_values():
    assert t_critical_95(29) == pytest.approx(2.045)
    assert t_critical_95(1) == pytest.approx(12.706)
    assert 1.96 < t_critical_95(500) < 1.98
    assert t_critical_95(35) < t_critical_95(30) and t_critical_95(35) > t_critical_95(40)


def test_confidence_interval_matches_hand_calculation():
    s = summarize([1, 2, 3, 4, 5])
    assert s["mean"] == 3 and s["n"] == 5
    assert s["std"] == pytest.approx(math.sqrt(2.5))
    half = 2.776 * math.sqrt(2.5) / math.sqrt(5)
    assert s["ci_half_width"] == pytest.approx(half, rel=1e-6)
    assert s["ci_low"] == pytest.approx(3 - half)


def test_summary_excludes_none_and_handles_small_n():
    s = summarize([1.0, None, 3.0, float("nan")])
    assert s["n"] == 2 and s["excluded"] == 2
    one = summarize([4.0])
    assert one["ci_low"] is None and one["std"] == 0.0
    assert summarize([])["mean"] is None


def test_sample_std_uses_n_minus_1():
    assert sample_std([2, 4]) == pytest.approx(math.sqrt(2))


def test_mathis_formula_units():
    # MSS 1460 B, RTT 50 ms, p = 1%  ->  (1460/0.05)*1.22/0.1 B/s = 356,240 B/s = 2.84992 Mbps
    assert mathis_throughput_mbps(1460, 0.05, 0.01) == pytest.approx(2.84992, rel=1e-4)
    with pytest.raises(ValueError):
        mathis_throughput_mbps(1460, 0.05, 0.0)


# ----------------------------------------------------------------------- export
def test_rows_to_csv_flattens_nested_and_handles_none():
    csv_text = export.rows_to_csv([{"a": 1, "b": {"c": 2}}, {"a": 3, "b": {"c": None}, "d": [1, 2]}])
    lines = csv_text.strip().split("\n")
    assert lines[0] == "a,b.c,d"
    assert lines[1] == "1,2,"
    assert lines[2].startswith("3,,")


def test_json_export_round_trip_and_rejects_nan():
    obj = {"x": [1, 2.5], "y": {"z": None}}
    assert json.loads(export.to_json(obj)) == obj
    with pytest.raises(ValueError):
        export.to_json({"bad": float("nan")})


def test_empty_rows_csv():
    assert export.rows_to_csv([]) == ""
