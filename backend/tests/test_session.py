import pytest

from app.simulation import lab
from app.simulation.config import ConfigError, SimulationConfig
from app.simulation.experiment import run_session, segment_size_bytes, segment_size_megabits
from app.simulation.stats import mathis_throughput_mbps


def cfg(**over):
    d = {"seed": 1}
    d.update(over)
    return SimulationConfig.from_dict(d)


def test_segment_size_calculation_and_units():
    assert segment_size_megabits(3.0, 4.0) == 12.0  # R x T
    assert segment_size_bytes(3.0, 4.0) == 1_500_000  # 12 Mbit / 8 = 1.5 MB
    assert segment_size_bytes(0.35, 2.0) == 87_500


def test_same_seed_same_result_different_seed_differs():
    a = run_session(cfg(seed=7)).to_dict()
    b = run_session(cfg(seed=7)).to_dict()
    c = run_session(cfg(seed=8)).to_dict()
    assert a == b
    assert a["metrics"] != c["metrics"]


def test_zero_loss_high_bandwidth_behaves_sensibly():
    r = run_session(cfg(network={"bandwidth_mbps": 100.0, "profile": "constant", "loss_probability": 0.0,
                                 "rtt_ms": 20.0, "jitter_ms": 1.0, "queue_packets": 5000})).to_dict()
    m = r["metrics"]
    assert m["rebuffer_events"] == 0 and m["rebuffer_s"] == 0
    assert m["startup_delay_s"] > 0
    assert m["retransmissions"] == 0 and m["timeouts"] == 0
    assert r["segments"][-1]["bitrate_mbps"] == max(r["config"]["video"]["ladder_mbps"])
    assert m["qoe"] > 85


def test_bitrates_always_on_ladder_and_buffer_bounded():
    r = run_session(cfg()).to_dict()
    ladder = set(r["config"]["video"]["ladder_mbps"])
    assert all(s["bitrate_mbps"] in ladder for s in r["segments"])
    mx = r["config"]["video"]["max_buffer_s"]
    for p in r["timeline"]:
        assert p["buffer_s"] >= 0
        assert p["buffer_s"] <= mx + 1e-6
    # played position never exceeds content length
    assert r["timeline"][-1]["played_s"] == pytest.approx(r["config"]["video"]["duration_s"], abs=0.6)


def test_starved_link_causes_rebuffering_that_is_logged():
    r = run_session(cfg(network={"bandwidth_mbps": 0.2, "profile": "constant", "loss_probability": 0.0,
                                 "min_bandwidth_mbps": 0.05},
                        video={"duration_s": 40.0})).to_dict()
    m = r["metrics"]
    assert m["rebuffer_events"] >= 1 and m["rebuffer_s"] > 0
    assert [e for e in r["events"] if e["type"] == "stall_start"]
    assert r["stalls"] and r["stalls"][0]["end"] > r["stalls"][0]["start"]
    assert all(s["bitrate_mbps"] == 0.35 for s in r["segments"])  # nothing else fits


def test_startup_delay_includes_handshake_and_first_download():
    tcp = run_session(cfg(network={"profile": "constant", "loss_probability": 0.0, "rtt_ms": 200.0,
                                   "bandwidth_mbps": 50.0}, transport={"protocol": "tcp"})).to_dict()
    udp = run_session(cfg(network={"profile": "constant", "loss_probability": 0.0, "rtt_ms": 200.0,
                                   "bandwidth_mbps": 50.0}, transport={"protocol": "udp"})).to_dict()
    assert tcp["metrics"]["startup_delay_s"] > 0.4  # two handshake RTTs alone are 0.4 s
    assert any(e["type"] == "connected" for e in tcp["events"])
    assert udp["metrics"]["startup_delay_s"] > 0


def test_every_segment_logs_abr_inputs_and_reason():
    r = run_session(cfg()).to_dict()
    for s in r["segments"]:
        for key in ("bitrate_mbps", "buffer_s", "rule", "reason", "estimate_mbps", "throughput_mbps"):
            assert key in s
        assert s["reason"]
    assert r["segments"][0]["rule"] == "startup-initial"


def test_transport_comparison_uses_identical_conditions():
    res = lab.compare_transports(cfg(seed=5), ("tcp", "udp", "quic"))
    tls = [run["result"]["timeline"] for run in res["runs"]]
    first_bw = [[p["bandwidth_mbps"] for p in t[:20]] for t in tls]
    assert first_bw[0] == first_bw[1] == first_bw[2]  # same bandwidth trace
    assert res["same_conditions"]["seed"] == 5


def test_invalid_config_raises():
    with pytest.raises(ConfigError):
        cfg(video={"segment_s": 500.0})


def test_increasing_loss_reduces_tcp_goodput_on_average():
    base = {"network": {"profile": "constant", "bandwidth_mbps": 30.0, "rtt_ms": 60.0,
                        "loss_probability": 0.0}}
    lossy = {"network": {"profile": "constant", "bandwidth_mbps": 30.0, "rtt_ms": 60.0,
                         "loss_probability": 0.02}}
    a = lab.run_trials(base, 5)["summary"]["mean_throughput_mbps"]["mean"]
    b = lab.run_trials(lossy, 5)["summary"]["mean_throughput_mbps"]["mean"]
    assert b < a


# --------------------------------------------------------------------- lab / stats
def test_trials_report_counts_and_ci():
    t = lab.run_trials({"seed": 1, "video": {"duration_s": 40.0}}, 6)
    q = t["summary"]["qoe"]
    assert t["n_ok"] == 6 and t["n_requested"] == 6 and t["excluded"] == []
    assert q["n"] == 6 and q["ci_low"] <= q["mean"] <= q["ci_high"]
    assert [r["seed"] for r in t["per_trial"]] == list(range(1, 7))


def test_trials_limits():
    with pytest.raises(ConfigError):
        lab.run_trials({}, 0)
    with pytest.raises(ConfigError):
        lab.run_trials({}, 1000)


def test_mathis_validation_zero_loss_excluded_and_valid_regime_close():
    res = lab.mathis_validation(loss_values=(0.0, 0.003), rtt_ms_values=(50.0,), n_trials=6)
    zero = [r for r in res["rows"] if r["loss_probability"] == 0.0][0]
    assert zero["excluded"] is True
    row = [r for r in res["rows"] if r["loss_probability"] == 0.003][0]
    assert row["mathis_mbps"] == pytest.approx(mathis_throughput_mbps(1460, 0.05, 0.003))
    assert row["regime_ok"]
    assert abs(row["rel_error"]) < 0.30  # same order, within 30% in the valid regime
    assert row["abs_error_mbps"] == pytest.approx(row["simulated_mbps"] - row["mathis_mbps"])


def test_mathis_flags_high_loss_regime():
    res = lab.mathis_validation(loss_values=(0.05,), rtt_ms_values=(50.0,), n_trials=3)
    row = res["rows"][0]
    assert not row["regime_ok"] and row["warnings"]
    assert row["simulated_mbps"] < row["mathis_mbps"]  # timeouts make reality worse than the bound


def test_sensitivity_rejects_unknown_parameter_and_runs_valid_one():
    with pytest.raises(ConfigError):
        lab.sensitivity({}, "video.nope", [1.0], 2)
    s = lab.sensitivity({"video": {"duration_s": 40.0}}, "abr.safety_factor", [0.5, 1.0], 3)
    assert [p["value"] for p in s["points"]] == [0.5, 1.0]
    assert all(p["summary"]["qoe"]["n"] == 3 for p in s["points"])


def test_abr_comparison_runs_both_strategies_on_same_trace():
    res = lab.compare_abr({"seed": 4, "video": {"duration_s": 40.0}})
    kinds = [r["strategy"] for r in res["runs"]]
    assert kinds == ["throughput", "buffer"]
    bw = [[p["bandwidth_mbps"] for p in r["result"]["timeline"][:10]] for r in res["runs"]]
    assert bw[0] == bw[1]
