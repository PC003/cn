# Netflix Streaming Transport Lab

**An Interactive Simulation of TCP, UDP, Adaptive Bitrate Streaming, Buffering and Network Conditions**

A Computer Networks case-study project built around the report *"Transport Layer in Practice —
How Netflix Streams Video Using TCP and UDP."* It is an educational simulation inspired by
Netflix's publicly documented architecture — **not** a reproduction of Netflix's proprietary
production systems.

> **Status: Review 1.** This review delivers the architecture, the working frontend/backend
> scaffold, and the conceptual/explanatory pages. The simulation engine (network, transport,
> buffer, ABR, QoE) is intentionally not implemented yet — see [Roadmap](#roadmap).

---

## Table of contents

- [Engineering problem](#engineering-problem)
- [Objectives](#objectives)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [What's implemented in Review 1](#whats-implemented-in-review-1)
- [Roadmap](#roadmap)
- [Installation & running](#installation--running)
- [Running tests](#running-tests)
- [Assumptions](#assumptions)
- [Limitations](#limitations)
- [Viva questions](#viva-questions)

## Engineering problem

Modern video streaming must deliver enormous amounts of data to geographically distributed
clients while available bandwidth, latency, packet loss and jitter constantly change.

- **TCP** provides reliable, ordered, congestion-controlled delivery, but introduces connection
  setup, retransmission delay, head-of-line blocking and connection state.
- **UDP** provides low-overhead, connectionless delivery, but no built-in reliability, ordering,
  retransmission or congestion control.

This project is being built to *experimentally* demonstrate how these trade-offs propagate
through a real streaming pipeline: network conditions → transport behaviour → segment delivery →
buffer → ABR decision → video quality → QoE — rather than asserting them as textbook facts.

## Objectives

1. Model TCP-like and UDP-like transport behaviour at a simplified, teachable level.
2. Simulate segmented adaptive-bitrate video delivery under varying network conditions.
3. Implement at least two ABR algorithms (throughput-based, buffer-based) and show *why* each
   decision was made.
4. Simulate a playback buffer and detect rebuffering/stalls.
5. Produce every metric and conclusion from measured simulation output — never hard-coded.
6. Clearly label every simplification, so nothing is mistaken for Netflix's real implementation.

## Architecture

**Application architecture** (this project):

```
User → React UI → FastAPI → Experiment Controller → Network Simulator
     → Transport Model → Streaming Model → ABR Controller → Buffer
     → QoE Analyzer → Database / Results (SQLite)
```

**Open Connect architecture** (conceptual, as described in the report):

```
AWS Control Plane (auth, steering, cache health)
        ↓
Open Connect Backbone
        ↓
Open Connect Appliance (FreeBSD, NGINX, sendfile/kTLS)
        ↓
Client
```

The control plane decides/coordinates playback and server selection; the data plane (the OCA)
delivers the video itself, directly to the client. Both diagrams are interactive on the
[`/architecture`](frontend/src/pages/Architecture.tsx) page.

## Technology stack

| Layer | Choice |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS v4, React Router, Recharts, Lucide icons |
| Backend | Python, FastAPI, Pydantic, NumPy, Pandas |
| Database | SQLite (Review 2+) |
| Communication | REST (implemented); WebSockets for Live Mode (Review 3) |
| Testing | pytest (backend), tsc (frontend type-checking) |

## Project structure

```
cn/
├── frontend/
│   └── src/
│       ├── components/     # Layout, Card, Callout, FlowDiagram, ClickableFlow, PlannedPage, ...
│       ├── pages/           # Home, Architecture, ReportMapping, VivaMode, About, ExperimentLab, ...
│       ├── hooks/            # useTheme, useBackendStatus
│       ├── services/         # api.ts — typed fetch wrapper around the backend
│       ├── types/             # nav.ts — single source of truth for the app's page map
│       ├── charts/             # (Review 2+)
│       └── utils/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, router registration
│   │   ├── config.py          # Project metadata surfaced via /api/info
│   │   ├── api/                # meta.py (health/info); experiment/results routers land in Review 2
│   │   ├── models/              # Pydantic schemas
│   │   ├── simulation/           # network, packet, tcp_model, udp_model, congestion, buffer, abr, qoe, experiment
│   │   │                          # — scaffolded, each raises NotImplementedError until its review lands
│   │   └── database/               # SQLite persistence (Review 2)
│   ├── tests/                       # pytest — 13 tests, all passing
│   └── requirements.txt
├── docs/
└── README.md
```

## What's implemented in Review 1

- Full React + TypeScript + Vite + Tailwind frontend scaffold, routed and responsive
  (desktop sidebar, mobile dropdown nav, dark/light mode).
- Full FastAPI backend scaffold with CORS, a typed `/api/health` and `/api/info` endpoint, and
  the complete planned module layout for the simulation engine (each module currently raises
  `NotImplementedError` — no fabricated behaviour anywhere).
- Live frontend ↔ backend connectivity, shown on the Home page ("Backend connected").
- Fully written, non-placeholder pages:
  - **Home** — problem statement, conceptual pipeline, architecture preview, live backend status.
  - **Architecture** — two clickable diagrams (this app's software architecture; the Open Connect
    conceptual architecture from the report).
  - **Report → Project mapping** — traceability table from each report section to a concrete
    feature, with status badges.
  - **Packet Capture Guide** — a fully self-contained Wireshark walkthrough for later local
    TCP/UDP socket experiments.
  - **Viva Mode** — 23 expandable Q&As grounded in the report and in what this project actually
    implements.
  - **About / Assumptions** — explicit assumptions and limitations, written before any simulation
    exists, so scope can't silently creep.
- Placeholder pages for every Review 2/3 feature (Experiment Lab, TCP vs UDP, ABR Lab, Live
  Simulation, Results, What-If Analysis, Experiment History) that state plainly what they will do
  and what they depend on — no dead links, no faked functionality.
- 13 backend tests (endpoint behaviour + a "stubs must raise, never fake" contract test) and a
  clean `tsc` build on the frontend.

## Roadmap

| Review | Focus |
|---|---|
| **1 (this review)** | Architecture, scaffolding, conceptual/explanatory pages, working frontend↔backend |
| **2** | Network/packet/TCP-like/UDP-like/buffer models, SQLite persistence, Results & Experiment History pages |
| **3** | ABR algorithms, Experiment Lab, TCP vs UDP controlled comparison, Live Simulation + failure injection, What-If/Sensitivity analysis, export, optional local socket experiment |

## Installation & running

Requires Node.js 18+ and Python 3.12+.

### Backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api/*` to `http://localhost:8000`, so the frontend dev server (default
`http://localhost:5173`) talks to the backend without any extra configuration.

## Running tests

```bash
cd backend
source venv/bin/activate
python -m pytest -v
```

```bash
cd frontend
npx tsc -b        # type-checking
npm run build     # production build
```

## Assumptions

See the [About / Assumptions](frontend/src/pages/About.tsx) page for the full, current list.
In summary: TCP/UDP/congestion/ABR/QoE will all be simplified, seeded, reproducible models built
for teaching, not for benchmarking; network conditions are simulated, not measured from a real
network; and no claim is made beyond what the report documents.

## Limitations

This is an educational simulation and does not reproduce Netflix's proprietary production
infrastructure. It is not connected to, and does not observe, real Netflix traffic. Results are
only meaningful as comparisons *within* this simulator, under matched conditions (same seed, same
trace) — not as real-world performance figures.

## Viva questions

The full set of 23 anticipated viva questions, with answers grounded in the report and in what
this project implements, is available in-app at `/viva` and in
[`frontend/src/pages/VivaMode.tsx`](frontend/src/pages/VivaMode.tsx).
