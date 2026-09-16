PROJECT_NAME = "Netflix Streaming Transport Lab"
PROJECT_SUBTITLE = (
    "An Interactive Simulation of TCP, UDP, Adaptive Bitrate Streaming, "
    "Buffering and Network Conditions"
)
REPORT_TITLE = "Transport Layer in Practice — How Netflix Streams Video Using TCP and UDP"

# Current development phase, surfaced to the frontend so Home can show live
# project status. Update this as later reviews land.
CURRENT_PHASE = "Review 1 — Architecture, scaffolding and conceptual pages"
REVIEW_MILESTONE = 1

# Simulation modules that exist as files (per the planned structure) but whose
# logic is implemented in later reviews. Listed here purely for transparency
# on the /api/info endpoint.
PLANNED_SIMULATION_MODULES = [
    "network.py — bandwidth/latency/jitter/loss generator",
    "packet.py — packet data model",
    "tcp_model.py — simplified TCP-like transport",
    "udp_model.py — simplified UDP-like transport",
    "congestion.py — simplified congestion window model",
    "buffer.py — playback buffer simulation",
    "abr.py — throughput-based / buffer-based / hybrid ABR",
    "qoe.py — simplified QoE scoring",
    "experiment.py — experiment controller orchestrating the above",
]
