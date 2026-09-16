"""
Simplified UDP-like transport model — planned for Review 2.

Report section: "Where UDP fits".

Planned behaviour: connectionless independent datagrams, no automatic
retransmission or ordering, configurable loss/reordering, and an optional
application-level recovery layer to demonstrate that reliability over UDP
must be built by the application, not the transport.
"""


def run_udp_transfer(*args, **kwargs):
    raise NotImplementedError("UDP-like transport model is scheduled for Review 2.")
