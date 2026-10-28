# StreamLens

*TCP-like, UDP-like and QUIC-like streaming, ABR and QoE lab*

**An Interactive, Reproducible Simulation of TCP-like, UDP-like and QUIC-like Transport, Adaptive Bitrate Streaming, Buffering and QoE**

A Computer Networks case-study project built around the report *"Transport Layer in Practice —
How Netflix Streams Video Using TCP and UDP"* (abstract: [`docs/abstract.md`](docs/abstract.md)).
It is an educational simulation inspired by Netflix's publicly documented architecture — **not** a
reproduction of Netflix's proprietary production systems, and its protocols are *models*, not
implementations of TCP, UDP or QUIC.

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Objectives](#objectives)
3. [System architecture](#system-architecture)
4. [Module descriptions](#module-descriptions)
5. [Installation and setup](#installation-and-setup)
6. [Running the application and the simulator](#running-the-application-and-the-simulator)
7. [Simulation assumptions](#simulation-assumptions)
8. [Equations and the QoE formula](#equations-and-the-qoe-formula)
9. [Why head-of-line blocking, UDP recovery policy and ABR behaviour matter](#why-the-observed-behaviours-arise)
10. [Experiment methodology](#experiment-methodology)
11. [Generating results](#generating-results)
12. [Example results](#example-results)
13. [Testing](#testing)
14. [Limitations and threats to validity](#limitations-and-threats-to-validity)
15. [Optional real-socket experiment](#optional-real-socket-experiment)
16. [Future improvements](#future-improvements)
17. [Repository layout](#repository-layout)

## Problem statement

Video streaming must deliver high-bitrate content over paths whose bandwidth, latency, jitter and
loss vary continuously. The transport protocol decides how that variability is converted into
delay, throughput and, ultimately, what the viewer sees:

- **TCP** gives reliable, ordered, congestion-controlled delivery but adds connection setup,
  retransmission delay and head-of-line blocking.
- **UDP** gives low-overhead independent datagrams but no reliability, ordering or congestion
  control; anything reliable must be built by the application.
- **QUIC** (UDP-based) adds reliability and congestion control with independent streams.

The question this project answers *experimentally* is: **under which network conditions does
transport behaviour measurably change rebuffering and QoE, and how much does ABR adaptation
compensate?** — and, as importantly, *why*.

## Objectives

1. Model TCP-like, UDP-like and (optionally) QUIC-like delivery at a transparent, teachable level.
2. Simulate segmented adaptive-bitrate video delivery with a real playback buffer.
3. Implement throughput-based and buffer-based ABR and log the rule and reason of every decision.
4. Compute a documented, configurable QoE score from measured simulation output.
5. Compare transports under *identical* network traces, loss draws and seeds.
6. Back claims with statistics: repeated seeds, 95% confidence intervals, and a comparison of the
   TCP-like model with the Mathis throughput approximation.
7. Make every simplification explicit; never show a number that was not measured from a run.

## System architecture

```
React dashboard ──HTTP/JSON──▶ FastAPI ──▶ ┌──────────────────────────────────────────┐
                                           │ app.simulation  (pure Python engine)      │
CLI (python -m app.cli) ─────────────────▶ │  network → transport → buffer → ABR → QoE │
pytest ──────────────────────────────────▶ │  lab: trials · sweeps · Mathis · export   │
                                           └──────────────────────────────────────────┘
```

The engine has **no dependency on the web layer**; the API, the CLI and the tests all call the same
functions. Everything is deterministic given `(configuration, seed)`.

Per segment, the session loop is:

```
ABR.decide(buffer, throughput history) → bitrate → size = R × T
  → transport.deliver(size, t_request) → completion time, loss/retransmission stats
  → buffer.advance(t_complete); buffer.add(T) → startup / stall bookkeeping → QoE
```

## Module descriptions

| Module (`backend/app/`) | Responsibility |
|---|---|
| `simulation/config.py` | Unit-explicit dataclasses, validation, `from_dict` (rejects unknown keys), network presets |
| `simulation/network.py` | Seeded bandwidth traces (constant / random walk / time-stepped), impairment windows, loss/RTT/jitter, keyed deterministic draws |
| `simulation/transport.py` | `SegmentDelivery` record and the abstract transport interface |
| `simulation/congestion.py` | Reno-style AIMD congestion window (slow start, avoidance, fast loss, timeout, idle restart) |
| `simulation/tcp_model.py` | TCP-like reliable transport: handshake, cwnd rounds, fast retransmit, RTO, head-of-line blocking |
| `simulation/udp_model.py` | UDP-like datagrams: pacing, bottleneck queue, jitter/reordering, recovery policy (none / ARQ / FEC) |
| `simulation/quic_model.py` | QUIC-like extension: 1-RTT setup, per-stream ordering, faster loss timer |
| `simulation/buffer.py` | Playback buffer: growth, depletion, startup, stalls, never negative |
| `simulation/abr.py` | Throughput-based and buffer-based (BBA-0 style) ABR with decision logging |
| `simulation/qoe.py` | Transparent, configurable QoE score |
| `simulation/experiment.py` | One seeded streaming session → segments, events, timeline, metrics, QoE |
| `simulation/lab.py` | Controlled comparisons, repeated trials, sweeps, sensitivity, Mathis validation |
| `simulation/stats.py` | Mean, sample std, Student-t 95% CI, Mathis formula |
| `simulation/export.py` | JSON / CSV serialisation |
| `api/simulation.py` | HTTP endpoints over `lab`/`experiment` |
| `cli.py` | Command-line interface |

Frontend pages (`frontend/src/pages/`): **Home** (overview), **Experiment Lab** (network config,
simulation controls, run, repeated trials), **TCP vs UDP** (performance comparison),
**ABR Lab**, **Live Simulation** (replay + failure injection), **Results** (QoE dashboard, segment
and event logs, export), **What-If** (sensitivity analysis), **Model Validation** (Mathis, loss ×
RTT sweep, repeated trials) and **Experiment History**. Architecture, methodology, assumptions and
viva material live in this README and `docs/`, not in the website.

## Installation and setup

Requires Python 3.12+ and Node.js 18+.

```bash
# backend
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# frontend
cd ../frontend
npm install
```

## Running the application and the simulator

**Web application** (two terminals):

```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --port 8000
```

```bash
cd frontend && npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to port 8000. Interactive API docs are at
<http://localhost:8000/docs>.

**Command line** (from `backend/`, virtualenv active) — no server needed:

```bash
python -m app.cli run --preset mobile_4g --protocol tcp --seed 7
python -m app.cli compare --preset lossy --seed 3 --out ../results/compare.json
python -m app.cli trials --protocol udp --n 30 --csv ../results/udp-trials.csv
python -m app.cli compare-trials --n 30 --out ../results/transports.json
python -m app.cli mathis --n 10 --out ../results/mathis.json --csv ../results/mathis.csv
python -m app.cli abr --preset sudden_drop --n 30
python -m app.cli sensitivity --param abr.safety_factor --values 0.4,0.6,0.8,1.0 --n 20
```

Presets: `stable_wifi`, `mobile_4g`, `congested`, `lossy`, `high_latency`, `sudden_drop`.
Any command accepts `--config file.json` (a `SimulationConfig` object).

## Simulation assumptions

Units: Mbps (1 Mbit = 10⁶ bit), seconds, bytes; loss is a per-packet probability (0.01 = 1%).

- **Network:** piecewise-constant bandwidth; independent per-packet loss plus tail drop at a
  bottleneck queue (default 100 packets); jitter is the standard deviation of one-way delay;
  single flow, no cross traffic.
- **Controlled comparison:** the bandwidth trace depends on the seed alone; loss draws are keyed by
  `(seed, segment, packet, attempt)`, so the first transmission of a packet sees the same draw under
  every transport.
- **Packets:** MSS 1,460 B payload (no headers modelled). A 3 Mbps × 4 s segment is 12 Mbit =
  1.5 MB ≈ 1,027 packets.
- **TCP-like:** 2-RTT setup, initial window 10, receive window 1,000 packets, fast retransmit on ≥ 3
  later deliveries, otherwise RTO = max(200 ms, 2·RTT) with exponential backoff, slow start after
  idle.
- **UDP-like:** no setup, paced at `3 × bitrate` by default (a sender policy, configurable), no
  congestion control, recovery chosen by `udp_recovery`.
- **QUIC-like:** 1-RTT setup, 4 streams per segment, 25 ms loss-timer floor.
- **Playback:** startup buffer 8 s, resume threshold 4 s, max buffer 30 s, 4 s segments, ladder
  0.35 / 0.75 / 1.5 / 3 / 6 Mbps (240p–1080p).

The equations are in the next section.

## Equations and the QoE formula

```
segment size [Mbit] = R [Mbps] × T [s]            bytes = Mbit × 10⁶ / 8
packets = ceil(bytes / MSS)
throughput ≈ min(cwnd · MSS / RTT, bandwidth)

Throughput ABR : est = harmonic_mean(last N goodputs);  safe = est × safety;  highest rung ≤ safe
Buffer ABR     : f(B) = R_min (B ≤ r) | linear | R_max (B ≥ r + c); step up/down only when f(B)
                 crosses the next/previous rung (hysteresis)

U(R)      = ln(1 + R/R_min) / ln(1 + R_max/R_min)
quality   = 100 · duration-weighted mean( U(R_k) · q_k )         q_k: delivered-quality factor
rebuffer  = w_r · 100 · stall/(content + stall) + w_e · n_stalls
startup   = min(cap, w_s · startup_delay)
switching = w_sw · 100 · mean |U(R_{k+1}) − U(R_k)|
QoE       = clamp(quality − rebuffer − startup − switching, 0, 100)

Mathis    : T ≈ (MSS / RTT) · 1.22 / √p              (MSS in bytes per packet, RTT in s)
CI95      : mean ± t(0.975, n−1) · s / √n
```

Default weights: `w_r = 4` points per 1% of stalled time, `w_e = 2` per stall, `w_s = 2` points/s
(cap 20), `w_sw = 0.5`. They are judgement calls, are editable, and are **not** calibrated against
viewer studies; the score is not an industry-standard metric. Every component is reported next to
the total.

## Why the observed behaviours arise

**Head-of-line (HOL) blocking in TCP-like delivery.** TCP releases bytes to the application strictly
in order. When packet *k* is lost, packets *k+1…* may already be at the receiver, but they wait in
the reorder buffer until the retransmission of *k* arrives — one RTT if three later packets
generate duplicate acknowledgements, or a full retransmission timeout if the loss is at the tail of
a burst. The simulator measures this exactly: `release_i = max_{j≤i} arrival_j`, and reports
`Σ(release_i − arrival_i)` in packet·seconds. The QUIC-like mode keeps the same recovery but orders
each of its independent streams separately, so far fewer packets wait.

**UDP-like delivery needs an application recovery policy.** UDP never retransmits and never slows
down. A segment that must be complete can be (a) accepted with gaps (no extra delay, damaged
quality), (b) repaired by NACK + resend (complete, but each round costs ≥ 1 RTT and the repair
traffic itself can be lost), or (c) protected with parity packets (no round trip, but extra
bandwidth and only partial protection). The outcome of "UDP vs TCP" therefore depends on the
policy and on the sender's rate policy, not on UDP alone. In the example results below the same UDP
transport scores both worse (no recovery) and better (ARQ) than TCP-like delivery.

**Buffer-based vs throughput-based ABR.** Throughput ABR observes *the transport*: whatever TCP
or UDP delivered in the last few segments sets the next bitrate, so a loss-depressed TCP
throughput directly lowers quality. Buffer ABR observes only *the consequence* (buffer occupancy)
and reduces quality only when the buffer is actually draining; it is smoother but reacts late to a
sudden collapse when the buffer is full. Which is better depends on conditions — the lab reports
both under identical traces.

## Experiment methodology

| # | Experiment | Where |
|---|---|---|
| 1 | Transport comparison: identical trace, loss draws, RTT/jitter, ladder, segment length, ABR, seed | TCP vs UDP page · `cli compare` / `compare-trials` |
| 2 | Loss × RTT sweep and TCP-like vs Mathis (p = 0 excluded; assumption-violating points flagged) | Model Validation page · `cli mathis` |
| 3 | Repeated trials (30 independent seeds): mean, std, 95% t-interval, n, excluded runs with reasons | Experiment Lab / Validation · `cli trials` |
| 4 | ABR comparison under the same traces | ABR Lab · `cli abr` |
| 5 | Sensitivity: safety factor, reservoir/cushion, segment length, max buffer, loss, RTT, variability, bandwidth, jitter | What-If page · `cli sensitivity` |
| 6 | Optional real TCP/UDP socket measurement (kept separate from simulator results) | `backend/experiments/socket_experiment.py`, [`docs/socket-experiment.md`](docs/socket-experiment.md) |

Seeds `base … base+n−1` are used for `n` trials; failed runs (if any) are excluded **and listed
with the reason**. For the Mathis check, bulk transfers on an effectively uncongested 1 Gbit/s path
are used so loss, not capacity, limits the window; each row reports simulated throughput (mean and
CI), theoretical throughput, absolute and relative error, the predicted window and whether the
formula's assumptions hold.

## Generating results

```bash
cd backend && source venv/bin/activate
python -m app.cli compare-trials --n 30 --seed 1 --out ../results/exp1-transport-comparison-30seeds.json
python -m app.cli mathis --n 10 --out ../results/exp2-mathis-validation.json --csv ../results/exp2-mathis-validation.csv
python -m app.cli trials --n 30 --seed 1 --out ../results/exp3-repeated-trials-default.json --csv ../results/exp3-per-seed.csv
python -m app.cli abr --preset sudden_drop --n 30 --seed 1 --out ../results/exp4-abr-comparison-sudden-drop.json
python -m app.cli abr --preset mobile_4g --n 30 --seed 1 --out ../results/exp4-abr-comparison-mobile-4g.json
python -m app.cli abr --config ../results/configs/deep-drop.json --n 10 --out ../results/exp4-abr-comparison-deep-drop.json
python -m app.cli sensitivity --param abr.safety_factor --values 0.4,0.6,0.8,1.0,1.2 --n 20 --seed 1 --out ../results/exp5-sensitivity-safety-factor.json
python -m app.cli sensitivity --param video.segment_s --values 2,4,6,8 --n 20 --seed 1 --out ../results/exp5-sensitivity-segment-duration.json
python -m app.cli sensitivity --param network.loss_probability --values 0,0.005,0.01,0.03 --n 20 --seed 1 --out ../results/exp5-sensitivity-loss.json
```

The whole set runs in about ten seconds. The files in [`results/`](results/) were produced by
exactly these commands; re-running them reproduces them byte for byte (same code, same seeds).
The dashboard's **Export** buttons write the same JSON/CSV structures.

## Example results

Produced by the commands above (default configuration: 8 Mbps mean random-walk bandwidth, 50 ms
RTT, 5 ms jitter, 0.5% loss, 120 s video, throughput ABR). Mean ± 95% CI over 30 seeds. These are
**simulator measurements under these assumptions**, not claims about real networks.

| Experiment 1 — transport (30 seeds) | QoE | Avg bitrate (Mbps) | HOL blocking (pkt·s) | Incomplete segments |
|---|---|---|---|---|
| TCP-like | 54.5 ± 1.3 | 1.90 ± 0.09 | 34.0 | 0 |
| QUIC-like | 55.9 ± 1.5 | 2.00 ± 0.10 | 6.5 | 0 |
| UDP-like, no recovery | 38.1 ± 1.5 | 2.70 ± 0.18 | 0 | 27.7 |
| UDP-like, ARQ | 60.5 ± 1.6 | 2.59 ± 0.18 | 0 | 0 |
| UDP-like, FEC (10%) | 41.9 ± 2.2 | 2.41 ± 0.18 | 0 | 11.5 |

UDP-like without recovery reaches a higher bitrate (no congestion control, no retransmission) but
most segments arrive damaged; with ARQ it scores highest here. No run rebuffered: the 30 s buffer
absorbs the delivery-time differences, so QoE differences come from bitrate, damage and startup.

| Experiment 4 — ABR (30 seeds) | Throughput ABR QoE | Buffer ABR QoE |
|---|---|---|
| `sudden_drop` preset | 55.3 ± 0.4 | 66.6 ± 0.6 |
| `mobile_4g` preset | 38.2 ± 1.4 | 52.2 ± 1.0 |

Under TCP-like transport with loss, the throughput estimate is depressed by loss recovery, which
makes throughput ABR conservative; buffer ABR is unaffected by that bias and uses more of the
available bandwidth. Neither strategy rebuffered in these presets (they never fall below the lowest
rung). A harsher trace reverses the picture: with an 8 → 0.6 Mbps → 8 Mbps step trace
(`results/configs/deep-drop.json`, 10 seeds) throughput ABR averaged QoE 48.3 with 1.1 s of
rebuffering, buffer ABR 42.5 (±12.5, a wide interval) with 6.8 s — a full buffer makes buffer-based ABR keep requesting high
bitrates until it has already drained.

**Experiment 2 — Mathis.** Where the formula's assumptions hold (predicted window ≥ 15 packets,
p ≤ 2%, not capacity-limited; 8 points), the TCP-like model's mean absolute relative error against
`T ≈ (MSS/RTT)·1.22/√p` is **9.4%** (simulated throughput is 6–13% above the bound at
p = 0.1–0.3%). At p ≥ 1% the window is small (≈ 12 packets at 1%, ≈ 7 at 3%), tail losses and
timeouts — which Mathis ignores — matter, and simulated throughput is 4–22% below the formula at
p = 1% and 23–53% below at p = 3%; those rows are flagged as outside the formula's regime.

**Experiment 5 — sensitivity (20 seeds).** The mean QoE rose from 37.9 (safety factor 0.4) to 67.5
(1.2); higher safety factors are *not* penalised here because the buffer prevents rebuffering in
this scenario — an artefact of the scenario and weights, visible by changing the preset. Segment
duration 2 / 4 / 6 / 8 s gave 52.3 / 54.4 / 51.9 / 61.0 (intervals overlap for the first three).
Loss 0 / 0.5 / 1 / 3% gave 77.5 / 54.4 / 46.3 / 23.6 with falling bitrate.

## Testing

```bash
cd backend && source venv/bin/activate
python -m pytest -v          # 98 tests: engine, statistics, API, export

cd ../frontend
npx tsc -b                   # type check
npm run build                # production build
npm run lint                 # oxlint
```

The suite covers: seed reproducibility, segment-size and unit conversion, buffer growth / depletion
/ stall / end of playback, startup delay, ladder bounds, ABR decision rules, loss and recovery
(retransmission, ARQ, FEC, HOL blocking), QoE formula arithmetic, t-interval arithmetic, Mathis
units, CSV/JSON export, invalid configurations and API error codes. Tests assert *relations*
(e.g. more loss ⇒ lower TCP goodput on average) rather than monotonicity of every metric, because
ABR and transport interactions legitimately produce exceptions.

## Limitations and threats to validity

- **Internal validity:** the TCP-like model is a round-based Reno-like abstraction. It agrees with
  Mathis within ~10% in the regime where the formula applies; that is a sanity check, not a proof
  that it reproduces any real stack. Tail-loss probes (TLP), RACK, SACK, CUBIC/BBR are not modelled,
  which makes tail losses more expensive than in modern Linux.
- **Construct validity:** QoE weights are not calibrated against viewer data; "better" depends on
  them (see What-If). Rebuffering is zero for many seeds, so its t-interval is approximate.
- **External validity:** synthetic traces, independent loss and jitter, one flow, no cross traffic,
  one bottleneck. The UDP-like sender policy (3× pacing, no feedback) strongly shapes UDP results.
- **Not measured:** nothing in the simulator comes from a real network. The optional socket
  experiment is separate (see below) and is not part of simulator output.

## Optional real-socket experiment

[`backend/experiments/socket_experiment.py`](backend/experiments/socket_experiment.py) runs a real
local TCP transfer and a real UDP flood on loopback and records connect time, goodput, loss and
reordering. A baseline run is stored in
[`docs/socket-experiment-results.json`](docs/socket-experiment-results.json). **No Wireshark
capture or induced loss/delay has been performed or recorded**; the procedure to do so is in
[`docs/socket-experiment.md`](docs/socket-experiment.md). Loopback has no propagation delay, so
those numbers say nothing about Internet behaviour.

## Future improvements

- Replay public mobile-throughput traces; bursty (Gilbert-Elliott) loss and correlated jitter.
- Cross traffic and a shared bottleneck; CUBIC/BBR and TLP/RACK variants.
- A hybrid (throughput + buffer) ABR and model-predictive control.
- QoE weights calibrated against a subjective dataset; VMAF-style quality mapping.
- Recorded Wireshark captures with `dnctl`/`netem`-induced loss compared with the simulator.

## Repository layout

```
backend/
  app/            FastAPI app, API routers, simulation engine, CLI
  experiments/    optional real-socket experiment (separate from the simulator)
  tests/          pytest suite
frontend/         React + TypeScript + Vite + Tailwind dashboard
docs/             abstract.md (unchanged), viva-preparation.md, socket-experiment.md,
                  implementation-plan.md, report-mapping.md
results/          measured outputs generated by the CLI commands above
```
