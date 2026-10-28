"""
Per-packet record used for the optional packet trace.

The transports simulate packets in vectorised bulk (a 6 Mbps segment is ~2,000
packets), so individual ``Packet`` records are only materialised for the first
``packet_trace_limit`` packets of segment 0 (``SimulationConfig``). The same
record type is produced by the TCP-like, UDP-like and QUIC-like models so their
behaviour can be compared packet by packet.
"""

from dataclasses import dataclass


@dataclass
class Packet:
    packet_id: int
    segment_id: int
    sequence_number: int
    size_bytes: int
    send_time: float
    arrival_time: float | None = None
    lost: bool = False
    retransmitted: bool = False
    delivered: bool = False
    in_order: bool = True
