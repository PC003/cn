"""
Experiment controller — planned for Review 2-3.

Orchestrates one full run: Network -> Transport -> Segment Download ->
Buffer -> ABR -> Playback -> Metrics, using a single seeded RNG shared by
every component so identical configuration + seed reproduces identical
results. Produces the structured ExperimentResult object described in the
project spec (section 53): timeline, segments, events and aggregate metrics.
"""


def run_experiment(*args, **kwargs):
    raise NotImplementedError("Experiment controller is scheduled for Review 2-3.")
