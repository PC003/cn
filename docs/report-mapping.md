# Report → Project mapping

Same content as the in-app [`/report-mapping`](../frontend/src/pages/ReportMapping.tsx) page,
kept here for offline reading during review.

| Report section | Project feature | Status |
|---|---|---|
| TCP vs UDP | Controlled TCP / UDP / QUIC-like comparison with 95% CIs (`/tcp-vs-udp`) | **Available** |
| Open Connect architecture | Architecture visualization (`/architecture`) | **Available** |
| Bulk video delivery over TCP/TLS | TCP-like handshake cost, cwnd, retransmission, HOL blocking (`/experiment-lab`, event log, packet trace) | **Available** |
| TCP optimization (RACK, PRR, BBR) | Simplified AIMD only; RACK/PRR/BBR explained conceptually, not simulated (`/methodology`) | **Available (conceptual)** |
| Where UDP fits | UDP-like transport with application recovery none / ARQ / FEC (`/tcp-vs-udp`) | **Available** |
| Adaptive bitrate streaming | ABR Lab: throughput-based and buffer-based with decision logs (`/abr-lab`) | **Available** |
| End-to-end request flow | Segment log: request, first byte, completion, buffer before/after (`/results`) | **Available** |
| Live streaming | Replay with failure injection (`/live-simulation`) | **Available** |
| Scale and performance | Not simulated: single client, single path | Out of scope |
| Discussion and conclusion | What-If sensitivity analysis and Mathis validation (`/what-if`, `/validation`) | **Available** |
