"""
Simulation configuration (engine-level, framework independent).

All quantities carry their unit in the field name:

    *_mbps  megabits per second (1 Mbit = 1e6 bit)
    *_ms    milliseconds
    *_s     seconds
    *_bytes bytes
    *_packets  whole packets
    loss_probability  a fraction in [0, 1)  (0.01 == 1 %)

The dataclasses validate themselves in ``validate()`` and can be built from
plain dictionaries with ``from_dict`` (unknown keys are rejected, so typos in
experiment files fail loudly instead of being silently ignored).
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import Any, Optional, Union, get_args, get_origin, get_type_hints


class ConfigError(ValueError):
    """Raised for an invalid or inconsistent simulation configuration."""


PROTOCOLS = ("tcp", "udp", "quic")
ABR_STRATEGIES = ("throughput", "buffer")
BANDWIDTH_PROFILES = ("constant", "random_walk", "steps")
UDP_RECOVERY = ("none", "arq", "fec")
UDP_ON_INCOMPLETE = ("accept", "drop")


# --------------------------------------------------------------------------- network
@dataclass
class Impairment:
    """A time-windowed fault: scale bandwidth, add loss and/or add delay."""

    start_s: float
    duration_s: float
    bandwidth_scale: float = 1.0
    extra_loss: float = 0.0
    extra_rtt_ms: float = 0.0

    def validate(self) -> None:
        if self.start_s < 0 or self.duration_s <= 0:
            raise ConfigError("impairment needs start_s >= 0 and duration_s > 0")
        if not 0.01 <= self.bandwidth_scale <= 10:
            raise ConfigError("impairment bandwidth_scale must be in [0.01, 10]")
        if not 0 <= self.extra_loss < 1:
            raise ConfigError("impairment extra_loss must be in [0, 1)")
        if self.extra_rtt_ms < 0:
            raise ConfigError("impairment extra_rtt_ms must be >= 0")


@dataclass
class NetworkConfig:
    bandwidth_mbps: float = 8.0
    rtt_ms: float = 50.0
    jitter_ms: float = 5.0
    loss_probability: float = 0.005
    profile: str = "random_walk"
    variability: float = 0.25
    trace_interval_s: float = 2.0
    min_bandwidth_mbps: float = 0.3
    max_bandwidth_mbps: Optional[float] = None
    steps: list[tuple[float, float]] = field(default_factory=list)
    impairments: list[Impairment] = field(default_factory=list)
    queue_packets: int = 100

    def validate(self) -> None:
        if self.bandwidth_mbps <= 0:
            raise ConfigError("bandwidth_mbps must be > 0")
        if self.rtt_ms <= 0:
            raise ConfigError("rtt_ms must be > 0")
        if self.jitter_ms < 0:
            raise ConfigError("jitter_ms must be >= 0")
        if not 0 <= self.loss_probability < 1:
            raise ConfigError("loss_probability must be in [0, 1)")
        if self.profile not in BANDWIDTH_PROFILES:
            raise ConfigError(f"profile must be one of {BANDWIDTH_PROFILES}")
        if self.variability < 0:
            raise ConfigError("variability must be >= 0")
        if self.trace_interval_s <= 0:
            raise ConfigError("trace_interval_s must be > 0")
        if self.min_bandwidth_mbps <= 0:
            raise ConfigError("min_bandwidth_mbps must be > 0")
        if self.max_bandwidth_mbps is not None and self.max_bandwidth_mbps < self.min_bandwidth_mbps:
            raise ConfigError("max_bandwidth_mbps must be >= min_bandwidth_mbps")
        if self.queue_packets < 1:
            raise ConfigError("queue_packets must be >= 1")
        if self.profile == "steps":
            if not self.steps:
                raise ConfigError("profile 'steps' needs at least one (time_s, mbps) point")
            last = -1.0
            for t, r in self.steps:
                if t < 0 or r <= 0:
                    raise ConfigError("steps need time_s >= 0 and mbps > 0")
                if t <= last:
                    raise ConfigError("steps must have strictly increasing times")
                last = t
        for imp in self.impairments:
            imp.validate()


# ------------------------------------------------------------------------- transport
@dataclass
class TransportConfig:
    protocol: str = "tcp"
    mss_bytes: int = 1460
    init_cwnd_packets: int = 10
    rwnd_packets: int = 1000
    handshake_rtts: Optional[float] = None  # None -> tcp 2, quic 1, udp 0
    min_rto_ms: Optional[float] = None  # None -> tcp 200, quic 25
    slow_start_after_idle: bool = True
    quic_streams: int = 4
    udp_pacing_factor: float = 3.0
    udp_recovery: str = "none"
    udp_max_repair_rounds: int = 3
    udp_fec_block: int = 20
    udp_fec_overhead: float = 0.1
    udp_on_incomplete: str = "accept"
    udp_concealment_penalty: float = 2.0

    def validate(self) -> None:
        if self.protocol not in PROTOCOLS:
            raise ConfigError(f"protocol must be one of {PROTOCOLS}")
        if not 200 <= self.mss_bytes <= 9000:
            raise ConfigError("mss_bytes must be in [200, 9000]")
        if self.init_cwnd_packets < 1:
            raise ConfigError("init_cwnd_packets must be >= 1")
        if self.rwnd_packets < self.init_cwnd_packets:
            raise ConfigError("rwnd_packets must be >= init_cwnd_packets")
        if self.handshake_rtts is not None and self.handshake_rtts < 0:
            raise ConfigError("handshake_rtts must be >= 0")
        if self.min_rto_ms is not None and self.min_rto_ms <= 0:
            raise ConfigError("min_rto_ms must be > 0")
        if self.quic_streams < 1:
            raise ConfigError("quic_streams must be >= 1")
        if self.udp_pacing_factor <= 0:
            raise ConfigError("udp_pacing_factor must be > 0")
        if self.udp_recovery not in UDP_RECOVERY:
            raise ConfigError(f"udp_recovery must be one of {UDP_RECOVERY}")
        if self.udp_max_repair_rounds < 0:
            raise ConfigError("udp_max_repair_rounds must be >= 0")
        if self.udp_fec_block < 2:
            raise ConfigError("udp_fec_block must be >= 2")
        if not 0 < self.udp_fec_overhead <= 1:
            raise ConfigError("udp_fec_overhead must be in (0, 1]")
        if self.udp_on_incomplete not in UDP_ON_INCOMPLETE:
            raise ConfigError(f"udp_on_incomplete must be one of {UDP_ON_INCOMPLETE}")
        if self.udp_concealment_penalty < 0:
            raise ConfigError("udp_concealment_penalty must be >= 0")


# ----------------------------------------------------------------------------- video
DEFAULT_LADDER_MBPS = [0.35, 0.75, 1.5, 3.0, 6.0]
DEFAULT_LADDER_LABELS = ["240p", "360p", "480p", "720p", "1080p"]


@dataclass
class VideoConfig:
    duration_s: float = 120.0
    segment_s: float = 4.0
    ladder_mbps: list[float] = field(default_factory=lambda: list(DEFAULT_LADDER_MBPS))
    startup_buffer_s: float = 8.0
    max_buffer_s: float = 30.0
    rebuffer_resume_s: float = 4.0

    def validate(self) -> None:
        if self.duration_s <= 0:
            raise ConfigError("duration_s must be > 0")
        if self.segment_s <= 0:
            raise ConfigError("segment_s must be > 0")
        if self.segment_s > self.duration_s:
            raise ConfigError("segment_s must not exceed duration_s")
        if not self.ladder_mbps:
            raise ConfigError("ladder_mbps must not be empty")
        if any(r <= 0 for r in self.ladder_mbps):
            raise ConfigError("every ladder bitrate must be > 0")
        if any(b <= a for a, b in zip(self.ladder_mbps, self.ladder_mbps[1:])):
            raise ConfigError("ladder_mbps must be strictly increasing")
        if self.startup_buffer_s <= 0 or self.rebuffer_resume_s <= 0:
            raise ConfigError("startup_buffer_s and rebuffer_resume_s must be > 0")
        if self.max_buffer_s < self.segment_s:
            raise ConfigError("max_buffer_s must be >= segment_s")
        if self.startup_buffer_s > self.max_buffer_s or self.rebuffer_resume_s > self.max_buffer_s:
            raise ConfigError("startup/resume thresholds must not exceed max_buffer_s")


# ------------------------------------------------------------------------------- ABR
@dataclass
class AbrConfig:
    strategy: str = "throughput"
    safety_factor: float = 0.8
    estimator_window: int = 5
    initial_level: int = 0
    reservoir_s: float = 8.0
    cushion_s: float = 16.0

    def validate(self) -> None:
        if self.strategy not in ABR_STRATEGIES:
            raise ConfigError(f"strategy must be one of {ABR_STRATEGIES}")
        if not 0 < self.safety_factor <= 1.5:
            raise ConfigError("safety_factor must be in (0, 1.5]")
        if self.estimator_window < 1:
            raise ConfigError("estimator_window must be >= 1")
        if self.initial_level < 0:
            raise ConfigError("initial_level must be >= 0")
        if self.reservoir_s < 0 or self.cushion_s <= 0:
            raise ConfigError("reservoir_s must be >= 0 and cushion_s > 0")


# ------------------------------------------------------------------------------- QoE
@dataclass
class QoEConfig:
    """Penalty weights, in QoE points (see qoe.py for the formula)."""

    rebuffer_ratio_penalty_per_pct: float = 4.0
    rebuffer_event_penalty: float = 2.0
    startup_penalty_per_s: float = 2.0
    startup_penalty_cap: float = 20.0
    switch_penalty_weight: float = 0.5

    def validate(self) -> None:
        for name in dataclasses.asdict(self):
            if getattr(self, name) < 0:
                raise ConfigError(f"QoE weight {name} must be >= 0")


# ----------------------------------------------------------------------- top level
@dataclass
class SimulationConfig:
    seed: int = 1
    network: NetworkConfig = field(default_factory=NetworkConfig)
    video: VideoConfig = field(default_factory=VideoConfig)
    transport: TransportConfig = field(default_factory=TransportConfig)
    abr: AbrConfig = field(default_factory=AbrConfig)
    qoe: QoEConfig = field(default_factory=QoEConfig)
    packet_trace_limit: int = 0

    def validate(self) -> "SimulationConfig":
        if not isinstance(self.seed, int) or isinstance(self.seed, bool) or self.seed < 0:
            raise ConfigError("seed must be a non-negative integer")
        if self.packet_trace_limit < 0 or self.packet_trace_limit > 5000:
            raise ConfigError("packet_trace_limit must be in [0, 5000]")
        self.network.validate()
        self.video.validate()
        self.transport.validate()
        self.abr.validate()
        self.qoe.validate()
        if self.abr.initial_level >= len(self.video.ladder_mbps):
            raise ConfigError("abr.initial_level is above the bitrate ladder")
        if self.abr.strategy == "buffer":
            if self.abr.reservoir_s + self.abr.cushion_s > self.video.max_buffer_s:
                raise ConfigError(
                    "buffer-based ABR needs reservoir_s + cushion_s <= video.max_buffer_s"
                )
        return self

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, data: Optional[dict[str, Any]]) -> "SimulationConfig":
        cfg = _build(cls, data or {})
        return cfg.validate()

    def replace(self, **changes: Any) -> "SimulationConfig":
        """Deep-copied config with top-level fields replaced."""
        d = self.to_dict()
        d.update(changes)
        return SimulationConfig.from_dict(d)

    def with_value(self, path: str, value: Any) -> "SimulationConfig":
        """Return a validated copy with ``section.field`` (or ``seed``) set."""
        d = self.to_dict()
        parts = path.split(".")
        node = d
        for p in parts[:-1]:
            if p not in node or not isinstance(node[p], dict):
                raise ConfigError(f"unknown parameter path '{path}'")
            node = node[p]
        if parts[-1] not in node:
            raise ConfigError(f"unknown parameter path '{path}'")
        node[parts[-1]] = value
        return SimulationConfig.from_dict(d)


# ----------------------------------------------------------------------- helpers
def _build(cls: type, data: Any) -> Any:
    """Recursively build dataclass ``cls`` from ``data``, rejecting unknown keys."""
    if not isinstance(data, dict):
        raise ConfigError(f"expected an object for {cls.__name__}, got {type(data).__name__}")
    hints = get_type_hints(cls)
    known = {f.name for f in dataclasses.fields(cls)}
    unknown = set(data) - known
    if unknown:
        raise ConfigError(f"unknown field(s) for {cls.__name__}: {sorted(unknown)}")
    kwargs = {name: _coerce(hints[name], value, f"{cls.__name__}.{name}") for name, value in data.items()}
    return cls(**kwargs)


def _coerce(tp: Any, value: Any, where: str) -> Any:
    origin = get_origin(tp)
    if origin is Union:
        args = [a for a in get_args(tp) if a is not type(None)]
        if value is None:
            return None
        return _coerce(args[0], value, where)
    if origin is list:
        (inner,) = get_args(tp)
        if not isinstance(value, (list, tuple)):
            raise ConfigError(f"{where} must be a list")
        return [_coerce(inner, v, where) for v in value]
    if origin is tuple:
        if not isinstance(value, (list, tuple)):
            raise ConfigError(f"{where} must be a pair")
        inner = get_args(tp)
        if len(value) != len(inner):
            raise ConfigError(f"{where} must have {len(inner)} elements")
        return tuple(_coerce(t, v, where) for t, v in zip(inner, value))
    if dataclasses.is_dataclass(tp):
        return _build(tp, value)
    if tp is bool:
        if not isinstance(value, bool):
            raise ConfigError(f"{where} must be true/false")
        return value
    if tp is int:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or int(value) != value:
            raise ConfigError(f"{where} must be an integer")
        return int(value)
    if tp is float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ConfigError(f"{where} must be a number")
        return float(value)
    if tp is str:
        if not isinstance(value, str):
            raise ConfigError(f"{where} must be a string")
        return value
    return value


# ------------------------------------------------------------------------ presets
NETWORK_PRESETS: dict[str, dict[str, Any]] = {
    "stable_wifi": dict(bandwidth_mbps=20.0, rtt_ms=20.0, jitter_ms=2.0, loss_probability=0.0005,
                        profile="constant"),
    "mobile_4g": dict(bandwidth_mbps=6.0, rtt_ms=60.0, jitter_ms=15.0, loss_probability=0.01,
                      profile="random_walk", variability=0.4),
    "congested": dict(bandwidth_mbps=3.0, rtt_ms=80.0, jitter_ms=20.0, loss_probability=0.02,
                      profile="random_walk", variability=0.3),
    "lossy": dict(bandwidth_mbps=10.0, rtt_ms=60.0, jitter_ms=8.0, loss_probability=0.05,
                  profile="constant"),
    "high_latency": dict(bandwidth_mbps=10.0, rtt_ms=300.0, jitter_ms=20.0, loss_probability=0.005,
                         profile="constant"),
    "sudden_drop": dict(bandwidth_mbps=8.0, rtt_ms=50.0, jitter_ms=5.0, loss_probability=0.002,
                        profile="steps", steps=[(0.0, 8.0), (40.0, 1.5), (80.0, 8.0)]),
}
