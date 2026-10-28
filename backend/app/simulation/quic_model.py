"""
Simplified QUIC-like transport (educational extension).

It reuses the reliable-delivery engine of the TCP-like model and changes only
the three properties that distinguish QUIC *in this teaching model*:

1. **Setup:** one round trip (transport + crypto combined) instead of two.
2. **Independent streams:** each segment is carried on ``quic_streams``
   interleaved streams (packet ``i`` -> stream ``i mod S``). A lost packet
   delays only its own stream, so far fewer received packets sit in the
   reorder buffer. Loss is still recovered by retransmission and the window is
   still shared (one congestion controller per connection).
3. **Faster loss timer:** a probe timeout floor of 25 ms instead of TCP's
   200 ms minimum RTO.

It is *not* an implementation of QUIC: no packet-number spaces, ACK ranges,
connection migration, 0-RTT, flow-control credit, or real loss-detection
algorithm (RFC 9002). Note that for one segment on one stream the completion
time of a reliable transfer is dominated by repairing the last hole, so the
head-of-line benefit appears mainly in ``hol_blocked_packet_s``, not in
segment completion time.
"""

from __future__ import annotations

from app.simulation.config import TransportConfig
from app.simulation.network import NetworkModel
from app.simulation.tcp_model import ReliableTransport


class QuicLikeTransport(ReliableTransport):
    name = "quic"
    label = "QUIC-like (simplified)"
    default_handshake_rtts = 1.0
    default_min_rto_s = 0.025

    def __init__(self, net: NetworkModel, cfg: TransportConfig, seed: int, packet_trace_limit: int = 0):
        super().__init__(net, cfg, seed, packet_trace_limit)
        self.n_streams = max(1, cfg.quic_streams)
