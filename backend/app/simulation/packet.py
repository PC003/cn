"""
Packet data model — planned for Review 2.

Fields (per project spec section 48): packet_id, segment_id,
sequence_number, size, send_time, arrival_time, lost, retransmitted,
delivered, in_order. Shared by both the TCP-like and UDP-like transport
models so their behaviour can be compared under identical packet traces.
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
