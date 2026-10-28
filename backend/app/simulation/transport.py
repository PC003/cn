"""
Shared transport-layer types: the per-segment delivery record and the abstract
transport interface implemented by the TCP-like, UDP-like and QUIC-like models.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Optional

from app.simulation.config import TransportConfig
from app.simulation.network import NetworkModel
from app.simulation.packet import Packet


class SimulationError(RuntimeError):
    """Raised when a simulation cannot make progress (should not happen with valid configs)."""


@dataclass
class SegmentDelivery:
    segment: int
    size_bytes: int
    t_request: float
    t_first_byte: float
    t_complete: float
    packets: int  # data packets in the segment
    packets_sent: int = 0  # every transmission incl. retransmissions / FEC parity
    packets_lost: int = 0  # transmissions lost (random loss + queue overflow)
    retransmissions: int = 0
    fast_retransmits: int = 0  # loss events detected by duplicate-ack style feedback
    timeouts: int = 0  # loss events that needed a retransmission timeout / app timer
    hol_blocked_packets: int = 0
    hol_blocked_packet_s: float = 0.0  # sum over packets of (in-order release - arrival)
    reordered_packets: int = 0
    late_packets: int = 0
    repair_rounds: int = 0
    fec_recovered_packets: int = 0
    delivered_fraction: float = 1.0
    cwnd_end: Optional[float] = None
    events: list[dict[str, Any]] = field(default_factory=list)
    packet_trace: list[Packet] = field(default_factory=list)

    @property
    def duration_s(self) -> float:
        return self.t_complete - self.t_request

    @property
    def goodput_mbps(self) -> float:
        d = self.duration_s
        if d <= 0:
            return 0.0
        return self.size_bytes * self.delivered_fraction * 8 / d / 1e6

    def to_dict(self) -> dict[str, Any]:
        return {
            "segment": self.segment,
            "size_bytes": self.size_bytes,
            "t_request": round(self.t_request, 4),
            "t_first_byte": round(self.t_first_byte, 4),
            "t_complete": round(self.t_complete, 4),
            "download_s": round(self.duration_s, 4),
            "goodput_mbps": round(self.goodput_mbps, 4),
            "packets": self.packets,
            "packets_sent": self.packets_sent,
            "packets_lost": self.packets_lost,
            "retransmissions": self.retransmissions,
            "fast_retransmits": self.fast_retransmits,
            "timeouts": self.timeouts,
            "hol_blocked_packets": self.hol_blocked_packets,
            "hol_blocked_packet_s": round(self.hol_blocked_packet_s, 4),
            "reordered_packets": self.reordered_packets,
            "late_packets": self.late_packets,
            "repair_rounds": self.repair_rounds,
            "fec_recovered_packets": self.fec_recovered_packets,
            "delivered_fraction": round(self.delivered_fraction, 6),
            "cwnd_end": None if self.cwnd_end is None else round(self.cwnd_end, 2),
        }


class Transport:
    """Abstract transport. One instance carries every segment of one session."""

    name = "abstract"
    label = "abstract transport"

    def __init__(
        self,
        net: NetworkModel,
        cfg: TransportConfig,
        seed: int,
        packet_trace_limit: int = 0,
    ):
        self.net = net
        self.cfg = cfg
        self.seed = seed
        self.packet_trace_limit = packet_trace_limit
        self.pkt_bits = cfg.mss_bytes * 8
        self.connected_at: Optional[float] = None

    # --- interface -----------------------------------------------------------
    def connect(self, t: float) -> tuple[float, list[dict[str, Any]]]:
        """Return (time the first request may be sent, events)."""
        raise NotImplementedError

    def deliver(
        self, segment: int, size_bytes: int, t_request: float, bitrate_mbps: float
    ) -> SegmentDelivery:
        raise NotImplementedError

    # --- helpers -------------------------------------------------------------
    def n_packets(self, size_bytes: int) -> int:
        return max(1, math.ceil(size_bytes / self.cfg.mss_bytes))
