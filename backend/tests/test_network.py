import numpy as np
import pytest

from app.simulation.config import Impairment, NetworkConfig
from app.simulation.network import STREAM_LOSS, NetworkModel


def model(**kw):
    seed = kw.pop("seed", 1)
    return NetworkModel(NetworkConfig(**kw), seed, horizon_s=300)


def test_same_seed_gives_identical_trace_and_draws():
    a = model(profile="random_walk", seed=11)
    b = model(profile="random_walk", seed=11)
    assert np.array_equal(a.rates, b.rates)
    assert np.array_equal(a.uniform_draws(STREAM_LOSS, 3, 0, 50), b.uniform_draws(STREAM_LOSS, 3, 0, 50))


def test_different_seed_changes_random_walk():
    a = model(profile="random_walk", seed=1)
    b = model(profile="random_walk", seed=2)
    assert not np.array_equal(a.rates, b.rates)


def test_random_walk_respects_bounds():
    m = model(profile="random_walk", bandwidth_mbps=5.0, variability=1.0,
              min_bandwidth_mbps=1.0, max_bandwidth_mbps=9.0)
    assert m.rates.min() >= 1.0 - 1e-9 and m.rates.max() <= 9.0 + 1e-9


def test_transfer_time_constant_rate_unit_conversion():
    m = model(profile="constant", bandwidth_mbps=8.0)
    # 8 Mbit at 8 Mbit/s is exactly one second
    assert m.transfer_time(0.0, 8e6) == pytest.approx(1.0)
    # 1 MB = 8e6 bit
    assert m.transfer_time(5.0, 1_000_000 * 8) == pytest.approx(1.0)


def test_transfer_time_integrates_across_steps():
    m = model(profile="steps", steps=[(0.0, 8.0), (1.0, 2.0)])
    # 8 Mbit in the first second, remaining 2 Mbit at 2 Mbit/s = 1 more second
    assert m.transfer_time(0.0, 10e6) == pytest.approx(2.0)
    assert m.rate_mbps_at(0.5) == 8.0 and m.rate_mbps_at(1.5) == 2.0


def test_impairment_scales_bandwidth_and_adds_loss_and_rtt():
    m = model(profile="constant", bandwidth_mbps=10.0, loss_probability=0.01, rtt_ms=40.0,
              impairments=[Impairment(start_s=5, duration_s=5, bandwidth_scale=0.1,
                                      extra_loss=0.05, extra_rtt_ms=100)])
    assert m.rate_mbps_at(2) == pytest.approx(10.0)
    assert m.rate_mbps_at(6) == pytest.approx(1.0)
    assert m.rate_mbps_at(11) == pytest.approx(10.0)
    assert m.loss_at(6) == pytest.approx(0.06) and m.loss_at(2) == pytest.approx(0.01)
    assert m.rtt_s_at(6) == pytest.approx(0.14)


def test_invalid_network_config():
    with pytest.raises(ValueError):
        NetworkModel(NetworkConfig(bandwidth_mbps=-1), 1)
