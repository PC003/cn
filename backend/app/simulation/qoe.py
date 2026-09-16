"""
Simplified Quality of Experience (QoE) scoring — planned for Review 3.

Planned formula (documented fully in README.md once implemented):
  qoe = quality_contribution - rebuffer_penalty - switching_penalty - startup_penalty,
  normalized to 0-100, with each component reported separately. This is a
  simplified educational model and does not claim to reproduce Netflix's
  internal QoE formula.
"""


def compute_qoe(*args, **kwargs):
    raise NotImplementedError("QoE model is scheduled for Review 3.")
