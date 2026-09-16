"""
Network simulator — planned for Review 2.

Responsibilities (report section: "Netflix Open Connect architecture" /
network conditions):
  - Produce bandwidth over time from a fixed value, a preset trace, or a
    generated noisy trace, given a random seed.
  - Produce latency, jitter, and packet-loss decisions per packet/time-step
    using an injectable random source (so tests and reruns are reproducible).
  - Support runtime "failure injection": bandwidth drop, loss spike, latency
    spike, and restore-to-baseline, for Live Simulation mode.

This module intentionally contains no logic yet. See docs/architecture.md
and the frontend's /architecture page for the intended data flow.
"""

from dataclasses import dataclass


@dataclass
class NetworkConditions:
    bandwidth_mbps: float
    latency_ms: float
    jitter_ms: float
    packet_loss_percent: float


def sample_conditions(time_s: float, seed: int) -> NetworkConditions:
    """Return network conditions at a given simulation time. Not yet implemented."""
    raise NotImplementedError("Network simulator is scheduled for Review 2.")
