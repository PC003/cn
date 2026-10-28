PROJECT_NAME = "StreamLens"
PROJECT_SUBTITLE = (
    "An Interactive Simulation of TCP, UDP, Adaptive Bitrate Streaming, "
    "Buffering and Network Conditions"
)
REPORT_TITLE = "Transport Layer in Practice — How Netflix Streams Video Using TCP and UDP"

# Current development phase, surfaced to the frontend so Home can show live
# project status.
CURRENT_PHASE = "Review 3 — Simulation engine, controlled experiments and dashboard"
REVIEW_MILESTONE = 3

# Simulation modules (all implemented), listed for transparency on /api/info.
PLANNED_SIMULATION_MODULES = [
    "config.py — validated, unit-explicit simulation configuration",
    "network.py — seeded bandwidth traces, impairments, loss/RTT/jitter",
    "packet.py — packet data model (optional per-packet trace)",
    "transport.py — shared delivery record and transport interface",
    "tcp_model.py — simplified TCP-like transport (cwnd, RTO, head-of-line blocking)",
    "udp_model.py — simplified UDP-like transport (datagrams, reordering, app recovery)",
    "quic_model.py — simplified QUIC-like transport (per-stream ordering, 1-RTT setup)",
    "congestion.py — simplified AIMD congestion window model",
    "buffer.py — playback buffer, startup and rebuffering",
    "abr.py — throughput-based and buffer-based (BBA-style) ABR",
    "qoe.py — transparent, configurable QoE score",
    "experiment.py — one seeded streaming session",
    "lab.py — trials, comparisons, sweeps, sensitivity, Mathis validation",
    "stats.py — means, t-intervals, Mathis formula",
    "export.py — JSON / CSV export",
]
