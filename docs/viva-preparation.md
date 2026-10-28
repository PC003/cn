# Viva preparation

Answers are written for *this* project. Where a number is quoted it comes from the committed
`results/` files (default configuration, seeds 1–30) and is a simulator measurement, not a claim
about real networks. Re-run the commands in the README to regenerate them.

---

## 1. Project framing

**Q. What does the project do in one minute?**
It is a seeded, reproducible simulator that chains network conditions → transport behaviour →
segmented video delivery → playback buffer → ABR decisions → QoE. TCP-like, UDP-like and
QUIC-like transports are compared under identical bandwidth traces and loss draws, and the results
are supported with repeated seeds, 95% confidence intervals and a check against the Mathis
throughput model.

**Q. Is this Netflix's real system?**
No. It is inspired by publicly documented accounts (HTTP(S) over TCP from Open Connect appliances,
client-side ABR). The protocols are teaching models; the project makes no claim to reproduce
proprietary behaviour.

**Q. What is your research question and what did you find?**
Under which conditions does head-of-line blocking measurably change rebuffering and QoE, and how
much does ABR compensate? In the default scenario no run rebuffered — a 30 s buffer plus ABR
absorbed the delivery-time differences — so QoE differed through bitrate, damaged segments and
startup. Transport effects on *rebuffering* appear only in harsher traces (low bandwidth, deep
drops, small buffers; see the What-If page).

## 2. TCP

**Q. What happens in the TCP-like model when a packet is lost?**
If at least three later packets in the same round are delivered (duplicate-ACK analogue) it is a
*fast retransmit*: one window halving, the lost packet is resent next round (~1 RTT). If too few
packets follow (tail loss) the sender waits for a retransmission timeout
`max(200 ms, 2·RTT)` (exponential backoff), and the window collapses to 1.

**Q. What is head-of-line blocking and how do you measure it?**
TCP delivers an ordered byte stream, so data behind a hole cannot be released. I record each
packet's arrival time and compute the in-order release time `max_{j≤i} arrival_j`; the sum of
`release − arrival` is the HOL blocking time in packet·seconds. In the 30-seed default experiment
TCP-like accumulated 34 packet·s per session versus 6.5 for QUIC-like.

**Q. Why the three-duplicate-ACK rule?**
It is the standard threshold for fast retransmit. It also reproduces why small windows and tail
losses are expensive: with a small window there are not enough later packets to trigger it.

**Q. How is the congestion window modelled? What is not?**
Reno-style AIMD: slow start doubles per round, congestion avoidance adds one packet per round, fast
loss halves, timeout resets to one packet. Not modelled: CUBIC, BBR, SACK, RACK, TLP, PRR, pacing,
delayed ACKs. Tail-loss probes would make tail losses cheaper than in this model.

**Q. Where does the Mathis formula come from and why compare against it?**
`T ≈ (MSS/RTT)·C/√p` follows from a periodic AIMD sawtooth: average window ~√(8/3p) packets, one
loss per cycle. It is a sanity check that the congestion model's throughput scales as 1/RTT and
1/√p. The 8 valid-regime points have a mean absolute relative error of 9.4%.

**Q. Why does the model deviate from Mathis at high loss?**
At p ≥ 1% the window is ~12 packets or less; tail losses and timeouts become common, and Mathis
assumes no timeouts. At 3% loss the simulated throughput is 23–53% below the bound. Those rows are
flagged rather than discarded.

**Q. What do `MSS` and `RTT` mean in the formula?**
MSS is the TCP payload per packet in bytes (1,460 here), *not* the video segment size. RTT is in
seconds. `(MSS/RTT)·1.22/√p` is bytes/s; × 8 / 10⁶ gives Mbps.

**Q. Why exclude p = 0?**
The formula diverges (division by zero); with p = 0 throughput is limited by capacity, the receive
window or the bottleneck queue instead.

## 3. UDP

**Q. Is UDP faster than TCP?**
Not necessarily, and the results show both: without recovery the UDP-like model reached a higher
bitrate (2.70 vs 1.90 Mbps) but about 28 of 30 segments arrived damaged, so QoE was lower (38.1 vs
54.5); with ARQ it scored higher (60.5). The outcome depends on recovery policy and sender rate
policy.

**Q. Why does UDP need an application recovery policy for video segments?**
UDP never retransmits or reorders. A segment that must be complete therefore needs ARQ (NACK +
resend, costs ≥ 1 RTT per round), FEC (parity overhead, no round trip, partial protection) — or it
must be accepted with gaps.

**Q. What about congestion control on UDP?**
None. The model paces at 3× the media bitrate; if that exceeds the link, the bottleneck queue
overflows and datagrams are dropped. A real application would add its own rate control.

**Q. How is reordering produced?**
Each datagram has an independent one-way delay with jitter; with tight pacing a later datagram can
arrive earlier. Independent per-packet jitter overstates reordering relative to real queueing delay.

## 4. QUIC

**Q. What does your QUIC-like mode capture?**
1-RTT setup, independent stream ordering (a hole stalls only its own stream), and a faster loss
timer. It does not implement packet-number spaces, ACK ranges, 0-RTT, flow-control credit or
RFC 9002.

**Q. Does QUIC remove head-of-line blocking?**
It removes *cross-stream* HOL blocking at the transport layer. Within one stream data is still
ordered, and for one segment the completion time is still set by the last repair. In the model
QUIC's gain is visible in HOL packet·seconds (6.5 vs 34) and startup, and only slightly in QoE
(55.9 vs 54.5, intervals overlap).

## 5. Retransmissions, RTT, loss, jitter

**Q. How do RTT and loss each affect throughput?**
Throughput ≈ cwnd·MSS/RTT, so it falls as 1/RTT; under random loss the equilibrium window scales as
1/√p, hence 1/(RTT·√p). In the validation table, doubling RTT roughly halves simulated throughput.

**Q. What is jitter in the model?**
The standard deviation of per-packet one-way delay variation. For TCP-like it perturbs round
timing; for UDP-like it creates reordering and may push packets past the receiver's gap timer
(counted as late/lost).

**Q. How does loss affect the *application*?**
TCP-like: delay (retransmissions) and lower throughput, hence lower ABR bitrate. UDP-like: damaged
or missing data unless repaired. That difference in *symptom* is the core of the comparison.

## 6. ABR and buffering

**Q. How do the two ABR algorithms work?**
Throughput: harmonic mean of the last 5 goodputs × safety factor 0.8, pick the highest rung that
fits. Buffer: a piecewise-linear map from buffer level to bitrate between a reservoir (8 s) and
reservoir + cushion (24 s), moving only when the map crosses an adjacent rung (hysteresis).

**Q. Why the harmonic mean?**
It is dominated by slow samples, so one fast segment does not cause an over-optimistic jump.

**Q. When does buffer-based beat throughput-based and when not?**
With loss-depressed TCP throughput, throughput ABR is conservative: buffer ABR had higher QoE in
both presets (66.6 vs 55.3; 52.2 vs 38.2). With a collapse to 0.6 Mbps under a full buffer, buffer
ABR kept asking for high bitrates and stalled for 6.8 s on average versus 1.1 s (with a wide
interval) — the failure mode of reacting to the buffer instead of to throughput.

**Q. How does the playback buffer behave?**
It grows by one segment duration per completed download and drains at 1 s/s while playing; it cannot
go negative — hitting zero starts a stall (unless the video ended). Playback starts at 8 s and
resumes at 4 s. The client idles when buffer + segment would exceed 30 s.

**Q. Why is startup delay larger for TCP than QUIC-like?**
Two handshake round trips versus one, plus slow start for the first segments.

## 7. QoE

**Q. How is QoE computed and can you defend the weights?**
`QoE = clamp(quality − rebuffer − startup − switching, 0, 100)` with a concave log utility of
bitrate. Weights (4 points per 1% stalled time, 2 per stall, 2 points per second of startup, 0.5
switching) are judgement calls and editable. They are not calibrated against subjective data, so
absolute scores are not meaningful outside the simulator and rankings can change with the weights.

**Q. Is it a standard metric?**
No — it is a simplified linear model in the spirit of Yin et al. (2015). It is not ITU-T P.1203 or
VMAF.

## 8. Statistics and validity

**Q. Why 30 seeds and how do you compute the interval?**
Each seed changes the bandwidth walk and loss draws. The 95% interval is
mean ± t(0.975, 29)·s/√30 = mean ± 2.045·s/√30. It assumes independent, roughly normal means;
zero-inflated metrics such as rebuffering are only approximately covered.

**Q. How do you make comparisons fair?**
Same seed ⇒ same bandwidth trace; loss draws are keyed by (seed, segment, packet, attempt), so
first transmissions face identical loss across transports; same ladder, segment length and ABR.

**Q. What would invalidate your conclusions?**
Bursty loss, cross traffic, real queue dynamics, different QoE weights, UDP rate policies other
than 3× pacing, tail-loss probes in TCP. The README lists these as threats to validity.

**Q. Is the simulator validated against real traffic?**
Only against theory (Mathis) in its valid regime. A loopback socket script exists with a baseline
run, but no Wireshark capture with induced loss has been recorded, so no real-network validation is
claimed.

**Q. Why is the simulator deterministic and why does it matter?**
Same configuration + seed ⇒ identical output (tested). It makes results reproducible and lets an
examiner re-run any figure.

## 9. Design

**Q. Why a round-based model instead of a packet-level event simulator?**
A session runs in ~10 ms, so 30-seed sweeps are interactive; the behaviour that matters for the
conclusions (loss, retransmission, HOL blocking) is retained via exact arrival times. The cost is no
ACK clocking or queue dynamics.

**Q. Why is the engine separate from FastAPI?**
So tests and the CLI use the same code as the dashboard and results are independent of the UI.

**Q. What would you do next?**
Bursty loss, cross traffic, real bandwidth traces, a hybrid ABR, and a recorded Wireshark
comparison with induced loss.
