"""
Playback buffer simulation — planned for Review 2.

Planned behaviour: buffer occupancy increases as segments finish downloading
and decreases at a fixed rate during playback; reaching zero triggers a
rebuffering/stall event. Tracks initial/max/min/average buffer and stall
count and duration over the simulation timeline.
"""


def step_buffer(*args, **kwargs):
    raise NotImplementedError("Buffer model is scheduled for Review 2.")
