# Netflix Streaming Transport Lab

**A Controlled, Reproducible Simulation of TCP, UDP and Adaptive Bitrate Streaming**

Case study: *Transport Layer in Practice — How Netflix Streams Video Using TCP and UDP*

## Abstract

Large-scale video streaming must deliver high-bitrate content across paths whose bandwidth,
latency, jitter and packet loss vary continuously. Publicly documented accounts of Netflix's Open
Connect platform describe bulk video delivery over HTTP(S) on TCP, with adaptive bitrate (ABR)
selection performed by the client, while UDP-based transports appear in other roles. This project
investigates how transport-layer behaviour propagates into the quality a viewer actually
experiences.

We present a seeded, reproducible, time-stepped simulator that chains network conditions,
transport behaviour, segmented video delivery, playback buffering, ABR decisions and a simplified
quality-of-experience (QoE) score. The transport layer is modelled as a simplified TCP-like
protocol (handshake, sequence numbers, retransmission, head-of-line blocking, congestion window)
and a simplified UDP-like protocol (independent datagrams, loss, reordering, optional
application-level recovery). Two ABR algorithms, throughput-based and buffer-based, are
implemented with every bitrate switch logged together with its decision rule.

Experiments are controlled: the two transports are compared under identical bandwidth traces,
loss patterns, jitter, video ladder and random seed, so only transport behaviour differs. A web
dashboard supports live failure injection, parameter sweeps, experiment history and export. All
reported values are measured from simulation output. The project makes no claim to reproduce
Netflix's proprietary systems; its purpose is to expose engineering trade-offs, not to declare a
universal winner.

**Keywords:** transport layer, TCP, UDP, head-of-line blocking, adaptive bitrate streaming,
playback buffer, QoE, content delivery network, network simulation.

## Contributions

1. A transport-to-QoE pipeline model that makes the causal chain between network conditions and
   viewer experience observable end to end.
2. A fair comparison harness: identical traces and seed, single varying factor.
3. Explainable ABR: every decision is stored with its inputs and rule.
4. Reproducibility: same configuration plus same seed yields identical results.

## Enhancements that raise the project from "demo" to "study"

| # | Enhancement | Why it earns marks |
|---|---|---|
| 1 | **Validate the TCP-like model against theory.** Sweep loss p and RTT, plot simulated throughput against the Mathis approximation, throughput ≈ (MSS/RTT) · 1.22/√p, and report the error. | Shows the model is defensible, not just plausible. |
| 2 | **Repeat each condition over many seeds** (e.g. 30) and report mean ± 95% confidence interval instead of single runs. | Turns anecdotes into evidence; examiners notice statistical rigour. |
| 3 | **Real socket experiment with packet captures.** Run local TCP and UDP transfers under induced loss/delay, capture in Wireshark, and compare the observed retransmissions and handshake with the simulator. | Connects simulation to a real measurement; strong evidence for the viva. |
| 4 | **Third transport mode: UDP with per-stream recovery (QUIC-like, clearly labelled).** Shows head-of-line blocking removed when loss on one stream does not stall others. | Directly extends the report's "where UDP fits" section. |
| 5 | **Replay real bandwidth traces** from public mobile-throughput datasets instead of only synthetic ones. | Moves results closer to realistic conditions. |
| 6 | **Ablation studies:** ABR safety factor, reservoir/cushion, segment duration (2 s vs 4 s), buffer size. | Demonstrates understanding of why each design choice exists. |
| 7 | **Threats to validity section** in the report: simplified congestion control, no cross-traffic, synthetic QoE weights. | Honest limitation analysis is rewarded; hiding it is penalised. |
| 8 | **Auto-generated experiment report** (config, trace, graphs, measured observations). | Makes results reproducible and presentation-ready. |

## Evaluation plan

- Research question: *Under which network conditions does TCP-like head-of-line blocking
  measurably change rebuffering and QoE, and how much does ABR adaptation compensate?*
- Independent variables: loss, latency, bandwidth, buffer size, ABR algorithm, transport.
- Dependent variables: rebuffering time, stall count, average bitrate, bitrate switches,
  retransmissions, QoE.
- Method: controlled sweeps with fixed seeds, repeated over multiple seeds, reported with
  confidence intervals.

## Limitations

This is an educational simulation and does not reproduce Netflix's proprietary production
infrastructure. TCP, UDP, congestion control, ABR and QoE are simplified models, and network
conditions are simulated rather than measured from the Internet.
