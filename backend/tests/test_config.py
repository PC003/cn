import pytest

from app.simulation.config import ConfigError, SimulationConfig


def test_default_config_is_valid():
    cfg = SimulationConfig().validate()
    assert cfg.video.ladder_mbps == sorted(cfg.video.ladder_mbps)


def test_from_dict_rejects_unknown_keys():
    with pytest.raises(ConfigError, match="unknown field"):
        SimulationConfig.from_dict({"network": {"bandwith_mbps": 5}})


@pytest.mark.parametrize(
    "patch",
    [
        {"network": {"bandwidth_mbps": 0}},
        {"network": {"rtt_ms": -5}},
        {"network": {"loss_probability": 1.0}},
        {"network": {"loss_probability": -0.1}},
        {"network": {"jitter_ms": -1}},
        {"network": {"profile": "steps", "steps": []}},
        {"network": {"profile": "steps", "steps": [[0, 5], [0, 6]]}},
        {"video": {"segment_s": 0}},
        {"video": {"duration_s": 2, "segment_s": 4}},
        {"video": {"ladder_mbps": []}},
        {"video": {"ladder_mbps": [1.0, 0.5]}},
        {"video": {"max_buffer_s": 2, "segment_s": 4}},
        {"video": {"startup_buffer_s": 40}},
        {"abr": {"strategy": "magic"}},
        {"abr": {"initial_level": 9}},
        {"abr": {"strategy": "buffer", "reservoir_s": 20, "cushion_s": 20}},
        {"transport": {"protocol": "sctp"}},
        {"transport": {"udp_recovery": "pray"}},
        {"seed": -3},
    ],
)
def test_invalid_configurations_are_rejected(patch):
    with pytest.raises(ConfigError):
        SimulationConfig.from_dict(patch)


def test_with_value_is_validated_and_does_not_mutate():
    cfg = SimulationConfig()
    new = cfg.with_value("network.rtt_ms", 120.0)
    assert new.network.rtt_ms == 120.0
    assert cfg.network.rtt_ms == 50.0
    with pytest.raises(ConfigError):
        cfg.with_value("network.rtt_ms", -1)
    with pytest.raises(ConfigError):
        cfg.with_value("network.nope", 1)


def test_round_trip_through_dict():
    cfg = SimulationConfig.from_dict({"seed": 5, "network": {"profile": "steps", "steps": [[0, 4], [10, 2]]}})
    again = SimulationConfig.from_dict(cfg.to_dict())
    assert again == cfg
