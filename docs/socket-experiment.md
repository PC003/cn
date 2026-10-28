# Optional real-socket experiment (Experiment 6)

This experiment is **separate from the simulator**. Nothing in `results/` comes from it, and nothing
here should be read as validating the simulator unless the capture steps below have actually been
run and the evidence saved.

## What exists

- `backend/experiments/socket_experiment.py` — runs a real TCP transfer and a real UDP flood on the
  loopback interface and records connect time, time to first byte, goodput, UDP loss and reordering.
- `docs/socket-experiment-results.json` — one recorded baseline run (macOS, loopback,
  no induced loss or delay).

Baseline observations (loopback, no shaping): TCP `connect()` completes in ~0.1–1 ms and delivers
every byte; the UDP flood delivered all datagrams because the receiver thread kept up. Loopback has
no propagation delay and no random loss, so it shows the *absence* of the effects the simulator
models. **No Wireshark capture has been performed or recorded.**

## Procedure to obtain real handshake / retransmission evidence

1. **Start a capture** on the loopback interface (`lo0` on macOS, `lo` on Linux) in Wireshark, with
   display filter `tcp.port == 5001 || udp.port == 5002`.
2. **Induce loss and delay** on loopback:
   - macOS (needs sudo):
     ```bash
     sudo dnctl pipe 1 config delay 50ms plr 0.02 bw 8Mbit/s
     echo "dummynet in proto {tcp,udp} from any to any pipe 1" | sudo pfctl -f - -e
     ```
     Undo with `sudo pfctl -d; sudo dnctl -q flush`.
   - Linux: `sudo tc qdisc add dev lo root netem delay 50ms loss 2%` (undo with
     `sudo tc qdisc del dev lo root`).
3. **Run the experiment** from `backend/`:
   ```bash
   python -m experiments.socket_experiment --repeats 3 --out ../docs/socket-experiment-shaped.json
   ```
4. **Observe in Wireshark**
   - TCP: SYN → SYN/ACK → ACK at the start (connection setup time ≈ 1 RTT);
     `[TCP Dup ACK]`, `[TCP Fast Retransmission]`, `[TCP Retransmission]` frames under loss;
     `Statistics → TCP Stream Graphs → Time-Sequence (tcptrace)` shows stalls behind holes.
   - UDP: no handshake; no ACKs; gaps in the application sequence number with no retransmission.
5. **Compare** with the simulator using the same loss and RTT
   (`python -m app.cli run --loss 0.02 --rtt 100 --protocol tcp`): the simulator should show a
   comparable *qualitative* pattern (setup RTTs, fast retransmits vs timeouts, UDP gaps) — not
   identical numbers.
6. **Record** the `.pcapng`, the JSON output and the exact `dnctl`/`netem` settings next to this
   file before claiming validation.

## Limits

- Loopback and Python threads are not an Internet path; kernel buffers and scheduling dominate.
- `dnctl`/`netem` loss is random and independent, matching the simulator's loss model, but real
  paths are bursty.
- The Python script cannot read `TCP_INFO` portably, so retransmission counts must come from the
  capture.
