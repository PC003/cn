"""
Simplified TCP-like transport model — planned for Review 2.

Report sections: "Bulk video delivery over TCP", TCP optimization
(RACK/PRR/BBR, discussed conceptually only).

Planned behaviour: connection setup (SYN/SYN-ACK/ACK), sequence numbers,
acknowledgements, in-order delivery with head-of-line blocking, timeout-based
loss detection, retransmission, and a simplified congestion window (see
congestion.py). This is explicitly labelled "Simplified TCP-like Model"
throughout the UI — it is not a full protocol-stack implementation.
"""


def run_tcp_transfer(*args, **kwargs):
    raise NotImplementedError("TCP-like transport model is scheduled for Review 2.")
