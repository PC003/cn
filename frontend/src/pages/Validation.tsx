import { useMemo, useState } from "react";
import { Loader2, Sigma } from "lucide-react";
import {
  CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { BackendGate, ErrorNote } from "../components/Notices";
import { Button, NumberField, TextField } from "../components/Field";
import { ExportButtons } from "../components/ExportButtons";
import { TrialsTable } from "../components/TrialsTable";
import { useLab } from "../state/LabContext";
import { api } from "../services/api";
import type { MathisResult, SweepResult, TrialsResult } from "../types/sim";
import { fmt, parseNumberList, pct } from "../utils/format";

const RTT_COLORS = ["#e5222b", "#0f6fde", "#147a3f", "#8250df", "#d68a00"];

export default function Validation() {
  const { config } = useLab();
  const [lossText, setLossText] = useState("0.001, 0.003, 0.01, 0.03");
  const [rttText, setRttText] = useState("20, 50, 100, 200");
  const [mathisTrials, setMathisTrials] = useState(10);
  const [mathis, setMathis] = useState<MathisResult | null>(null);
  const [sweepLoss, setSweepLoss] = useState("0, 0.01, 0.03");
  const [sweepRtt, setSweepRtt] = useState("30, 100, 250");
  const [sweepTrials, setSweepTrials] = useState(5);
  const [sweep, setSweep] = useState<SweepResult | null>(null);
  const [trialN, setTrialN] = useState(30);
  const [trials, setTrials] = useState<TrialsResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const guard = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const rtts = useMemo(() => Array.from(new Set(mathis?.rows.map((r) => r.rtt_ms) ?? [])), [mathis]);
  const chartData = useMemo(() => {
    if (!mathis) return [];
    const losses = Array.from(new Set(mathis.rows.filter((r) => !r.excluded).map((r) => r.loss_probability)));
    return losses.sort((a, b) => a - b).map((p) => {
      const row: Record<string, number | null> = { loss: p * 100 };
      mathis.rows.filter((r) => r.loss_probability === p && !r.excluded).forEach((r) => {
        row[`sim${r.rtt_ms}`] = r.simulated_mbps ?? null;
        row[`err${r.rtt_ms}`] = r.simulated_ci_high != null && r.simulated_mbps != null
          ? r.simulated_ci_high - r.simulated_mbps : 0;
        row[`th${r.rtt_ms}`] = r.mathis_mbps ?? null;
      });
      return row;
    });
  }, [mathis]);

  return (
    <div>
      <PageHeader
        eyebrow="Statistical validation"
        title="Model Validation"
        subtitle="Compare the TCP-like model with the Mathis approximation, sweep loss × RTT, and repeat sessions over many seeds with confidence intervals."
      />
      <BackendGate>
        <div className="space-y-8">
          <ErrorNote message={err} />

          {/* ----------------------------------------------------------- Mathis */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">1 · TCP-like throughput vs Mathis</h2>
            <Callout variant="warning" title="What this comparison can and cannot show">
              The Mathis bound <code className="font-mono">T ≈ (MSS/RTT)·1.22/√p</code> assumes periodic random
              loss, Reno-style AIMD, no timeouts and a window not limited by capacity or the receiver. p = 0 is
              excluded (the formula diverges). MSS here is the TCP payload per packet, not the video segment size.
              Rows outside those assumptions are flagged and are <em>expected</em> to deviate.
            </Callout>
            <Card>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField label="Loss probabilities (fractions)" value={lossText} onChange={setLossText} />
                <TextField label="RTTs (ms)" value={rttText} onChange={setRttText} />
                <NumberField label="Seeds per point" min={1} max={100} value={mathisTrials} onChange={setMathisTrials} />
              </div>
              <div className="mt-4">
                <Button disabled={busy !== null}
                  onClick={() => void guard("mathis", async () => {
                    setMathis(await api.mathis(parseNumberList(lossText), parseNumberList(rttText), mathisTrials));
                  })}>
                  {busy === "mathis" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sigma className="h-4 w-4" />}
                  Run bulk-transfer validation
                </Button>
              </div>
            </Card>
            {mathis && (
              <>
                <Card>
                  <p className="mb-2 text-xs font-medium text-text-muted">
                    Throughput (Mbps) vs loss (%) — solid: simulated mean ± 95% CI, dashed: Mathis
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="loss" type="number" scale="log" domain={["auto", "auto"]}
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} unit="%" />
                      <YAxis scale="log" domain={["auto", "auto"]} allowDataOverflow
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} width={44} />
                      <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {rtts.map((rtt, i) => (
                        <Line key={`s${rtt}`} dataKey={`sim${rtt}`} name={`sim ${rtt} ms`}
                          stroke={RTT_COLORS[i % RTT_COLORS.length]} strokeWidth={2}
                          isAnimationActive={false}>
                          <ErrorBar dataKey={`err${rtt}`} stroke={RTT_COLORS[i % RTT_COLORS.length]} />
                        </Line>
                      ))}
                      {rtts.map((rtt, i) => (
                        <Line key={`t${rtt}`} dataKey={`th${rtt}`} name={`Mathis ${rtt} ms`}
                          stroke={RTT_COLORS[i % RTT_COLORS.length]} strokeDasharray="5 4" dot={false}
                          isAnimationActive={false} />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[56rem] text-left text-xs">
                      <thead className="bg-surface-alt text-text-muted">
                        <tr>{["RTT ms", "Loss p", "Simulated Mbps", "95% CI", "Mathis Mbps", "Abs error", "Rel error",
                          "Window pkts", "Regime"].map((h) => (<th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr>
                      </thead>
                      <tbody>
                        {mathis.rows.map((r, i) => (
                          <tr key={i} className="border-t border-border align-top">
                            <td className="px-3 py-1.5">{r.rtt_ms}</td>
                            <td className="px-3 py-1.5">{r.loss_probability}</td>
                            {r.excluded ? (
                              <td colSpan={7} className="px-3 py-1.5 text-text-muted">Excluded: {r.reason}</td>
                            ) : (
                              <>
                                <td className="px-3 py-1.5 tabular-nums">{fmt(r.simulated_mbps)}</td>
                                <td className="px-3 py-1.5 tabular-nums">
                                  [{fmt(r.simulated_ci_low)}, {fmt(r.simulated_ci_high)}]</td>
                                <td className="px-3 py-1.5 tabular-nums">{fmt(r.mathis_mbps)}</td>
                                <td className="px-3 py-1.5 tabular-nums">{fmt(r.abs_error_mbps)}</td>
                                <td className="px-3 py-1.5 tabular-nums">{pct(r.rel_error)}</td>
                                <td className="px-3 py-1.5 tabular-nums">{fmt(r.predicted_window_packets, 0)}</td>
                                <td className="px-3 py-1.5">
                                  {r.regime_ok ? <span className="text-success">assumptions hold</span> : (
                                    <span className="text-warning">{r.warnings?.join("; ")}</span>)}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-text-muted">
                    Mean absolute relative error where the assumptions hold:{" "}
                    <strong className="text-text">{pct(mathis.mean_abs_rel_error_valid_regime)}</strong> over{" "}
                    {mathis.n_valid_regime_points} point(s).
                  </p>
                  <div className="mt-3">
                    <ExportButtons items={[
                      { label: "Mathis JSON", format: "json", filename: "mathis-validation", data: mathis },
                      { label: "Mathis CSV", format: "csv", filename: "mathis-validation",
                        rows: mathis.rows as unknown as Record<string, unknown>[] },
                    ]} />
                  </div>
                </Card>
              </>
            )}
          </section>

          {/* ------------------------------------------------------ loss × RTT sweep */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">2 · Streaming QoE across loss × RTT</h2>
            <Card>
              <p className="mb-3 text-xs text-text-muted">
                Full streaming sessions (current Experiment Lab configuration) for TCP-like and UDP-like at each
                loss/RTT cell; means over seeds.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField label="Loss probabilities" value={sweepLoss} onChange={setSweepLoss} />
                <TextField label="RTTs (ms)" value={sweepRtt} onChange={setSweepRtt} />
                <NumberField label="Seeds per cell" min={1} max={30} value={sweepTrials} onChange={setSweepTrials} />
              </div>
              <div className="mt-4">
                <Button disabled={busy !== null || !config}
                  onClick={() => void guard("sweep", async () => {
                    if (!config) return;
                    setSweep(await api.sweep(config, parseNumberList(sweepLoss), parseNumberList(sweepRtt),
                      sweepTrials, ["tcp", "udp"]));
                  })}>
                  {busy === "sweep" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sigma className="h-4 w-4" />}
                  Run sweep
                </Button>
              </div>
            </Card>
            {sweep && (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-xs">
                    <thead className="bg-surface-alt text-text-muted">
                      <tr>{["RTT ms", "Loss", "Protocol", "QoE", "Avg bitrate", "Rebuffer s", "Goodput", "n"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr>
                    </thead>
                    <tbody>
                      {sweep.cells.map((c, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-1.5">{c.rtt_ms}</td>
                          <td className="px-3 py-1.5">{c.loss_probability}</td>
                          <td className="px-3 py-1.5 uppercase">{c.protocol}</td>
                          {["qoe", "avg_bitrate_mbps", "rebuffer_s", "mean_throughput_mbps"].map((k) => (
                            <td key={k} className="px-3 py-1.5 tabular-nums">
                              {fmt(c.summary[k].mean)} ± {fmt(c.summary[k].ci_half_width)}</td>))}
                          <td className="px-3 py-1.5">{c.n_ok}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3">
                  <ExportButtons items={[{ label: "Sweep JSON", format: "json", filename: "loss-rtt-sweep", data: sweep }]} />
                </div>
              </Card>
            )}
          </section>

          {/* ------------------------------------------------------- repeated trials */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">3 · Repeated trials with confidence intervals</h2>
            <Card>
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-28">
                  <NumberField label="Seeds" min={2} max={100} value={trialN} onChange={setTrialN} />
                </div>
                <Button disabled={busy !== null || !config}
                  onClick={() => void guard("trials", async () => {
                    if (config) setTrials(await api.trials(config, trialN));
                  })}>
                  {busy === "trials" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sigma className="h-4 w-4" />}
                  Run {trialN} independent seeds
                </Button>
              </div>
            </Card>
            {trials && (
              <Card>
                <TrialsTable trials={trials} />
                <div className="mt-3">
                  <ExportButtons items={[
                    { label: "Trials JSON", format: "json", filename: "trials", data: trials },
                    { label: "Per-seed CSV", format: "csv", filename: "trials-per-seed", rows: trials.per_trial },
                  ]} />
                </div>
              </Card>
            )}
          </section>
        </div>
      </BackendGate>
    </div>
  );
}
