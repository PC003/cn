"""
Simplified congestion window model — planned for Review 2.

Report section: TCP optimization (RACK, PRR, BBR, discussed conceptually).

Planned behaviour: a generic congestion window that grows on successful
delivery and shrinks on detected loss. This does not implement or claim to
reproduce BBR, CUBIC, Reno, RACK or PRR — those are referenced in the report
and explained in Viva Mode, but this project models congestion generically.
"""


def update_congestion_window(*args, **kwargs):
    raise NotImplementedError("Congestion model is scheduled for Review 2.")
