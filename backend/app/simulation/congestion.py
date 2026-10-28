"""
Simplified congestion-window model (Reno-style AIMD).

Window values are in packets. The controller

* doubles the window each fully-used round in slow start (``cwnd += acked``),
* adds one packet per fully-used round in congestion avoidance,
* halves the window on a loss detected by duplicate-ack style feedback
  (fast retransmit / fast recovery, one reduction per loss event),
* collapses to one packet on a retransmission timeout and re-enters slow start,
* optionally restarts from the initial window after an idle period.

It deliberately does **not** implement CUBIC, BBR, RACK, PRR, SACK scoreboards,
pacing or ECN. Those are discussed conceptually in the report; modelling them
would not be defensible at this level of abstraction.
"""

from __future__ import annotations

import math


class CongestionController:
    def __init__(self, init_cwnd_packets: int, rwnd_packets: int):
        self.init_cwnd = float(init_cwnd_packets)
        self.rwnd = float(rwnd_packets)
        self.cwnd = float(init_cwnd_packets)
        self.ssthresh = math.inf

    @property
    def window(self) -> int:
        """Packets the sender may put in flight this round."""
        return max(1, int(min(self.cwnd, self.rwnd)))

    @property
    def in_slow_start(self) -> bool:
        return self.cwnd < self.ssthresh

    def on_round_acked(self, packets_acked: int, window_was_full: bool) -> None:
        """A whole round was acknowledged without loss."""
        if not window_was_full:
            return  # application-limited rounds do not validate a larger window
        if self.in_slow_start:
            self.cwnd += packets_acked
            if math.isfinite(self.ssthresh):
                self.cwnd = min(self.cwnd, self.ssthresh)
        else:
            self.cwnd += 1.0
        self.cwnd = min(self.cwnd, self.rwnd)

    def on_fast_loss(self) -> None:
        self.ssthresh = max(self.cwnd / 2.0, 2.0)
        self.cwnd = self.ssthresh

    def on_timeout(self) -> None:
        self.ssthresh = max(self.cwnd / 2.0, 2.0)
        self.cwnd = 1.0

    def on_idle_restart(self) -> None:
        self.cwnd = min(self.cwnd, self.init_cwnd)


def update_congestion_window(
    cc: CongestionController, event: str, packets_acked: int = 0, window_was_full: bool = True
) -> float:
    """Functional wrapper kept for the original module interface."""
    if event == "ack":
        cc.on_round_acked(packets_acked, window_was_full)
    elif event == "fast_loss":
        cc.on_fast_loss()
    elif event == "timeout":
        cc.on_timeout()
    elif event == "idle":
        cc.on_idle_restart()
    else:
        raise ValueError(f"unknown congestion event '{event}'")
    return cc.cwnd
