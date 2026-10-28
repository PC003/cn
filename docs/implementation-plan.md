# Implementation plan and status

The existing project (React + TypeScript + Vite frontend, FastAPI backend, simulation modules
scaffolded with `NotImplementedError` stubs, 13 tests) was preserved and extended in place.
`docs/abstract.md` is unchanged.

| Phase | Scope | Status |
|---|---|---|
| 1 | Inspect project, keep working files | done |
| 2 | Network + transport models (`network`, `congestion`, `tcp_model`, `udp_model`) | done, tested |
| 3 | Segmented delivery, playback buffer, ABR (`buffer`, `abr`, `experiment`) | done, tested |
| 4 | QoE and reproducible experiments (`qoe`, `lab`, `stats`) | done, tested |
| 5 | Dashboard connected to the engine (API + React pages) | done, build/type-check verified, pages exercised in the browser |
| 6 | Repeated trials, CIs, Mathis comparison | done, tested |
| 7 | Tests, README, export, viva document | done |
| 8 | QUIC-like mode; optional socket experiment | QUIC-like done; socket script + loopback baseline done; **Wireshark capture with induced loss not done** |

## Design decisions

- **Engine independent of the web layer** — API, CLI and tests all call `app.simulation`.
- **Round-based transport model** rather than per-packet event simulation: ~10 ms per session,
  which makes 30-seed sweeps interactive; per-packet records exist only for an optional trace.
- **Keyed random draws** `(seed, stream, segment, attempt)` so transports see identical first
  transmissions and results do not depend on call order.
- **Config validation up front** (`ConfigError` → HTTP 422) with unit-explicit field names.
- **History in browser `localStorage`** instead of a SQLite layer: results stay reproducible from the
  stored config + seed and the backend stays stateless.
