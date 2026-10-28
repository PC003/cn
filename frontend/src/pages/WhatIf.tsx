import { useMemo, useState } from "react";
import { Loader2, FlaskConical } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, ErrorBar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { ConfigPanel } from "../components/ConfigPanel";
import { BackendGate, ErrorNote } from "../components/Notices";
import { Button, NumberField, SelectField, TextField } from "../components/Field";
import { ExportButtons } from "../components/ExportButtons";
import { METRIC_LABELS } from "../utils/metrics";
import { useLab } from "../state/LabContext";
import { api } from "../services/api";
import type { SensitivityResult } from "../types/sim";
import { fmt, parseNumberList } from "../utils/format";

const SUGGESTED: Record<string, string> = {
  "abr.safety_factor": "0.4, 0.6, 0.8, 1.0, 1.2",
  "abr.reservoir_s": "2, 5, 8, 12",
  "abr.cushion_s": "6, 10, 16, 20",
  "video.segment_s": "2, 4, 6, 8",
  "video.max_buffer_s": "12, 20, 30, 60",
  "network.loss_probability": "0, 0.002, 0.01, 0.03",
  "network.rtt_ms": "20, 50, 100, 200, 400",
  "network.variability": "0, 0.15, 0.3, 0.5",
  "network.bandwidth_mbps": "2, 4, 8, 16",
  "network.jitter_ms": "0, 5, 20, 50",
};

export default function WhatIf() {
  const { config, defaults } = useLab();
  const [param, setParam] = useState("abr.safety_factor");
  const [valuesText, setValuesText] = useState(SUGGESTED["abr.safety_factor"]);
  const [nTrials, setNTrials] = useState(10);
  const [metric, setMetric] = useState("qoe");
  const [res, setRes] = useState<SensitivityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!config) return;
    const values = parseNumberList(valuesText);
    if (values.length === 0) return setErr("Enter at least one numeric value.");
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.sensitivity(config, param, values, nTrials));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const series = useMemo(
    () =>
      (res?.points ?? [])
        .filter((p) => p.summary)
        .map((p) => {
          const s = p.summary![metric];
          return { value: p.value, mean: s.mean, err: s.ci_half_width ?? 0, std: s.std };
        }),
    [res, metric],
  );

  const effect = useMemo(() => {
    if (series.length < 2) return null;
    const first = series[0];
    const last = series[series.length - 1];
    const best = [...series].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))[0];
    const overlap = (a: typeof first, b: typeof first) =>
      Math.abs((a.mean ?? 0) - (b.mean ?? 0)) <= a.err + b.err;
    return { first, last, best, overlap: overlap(first, last) };
  }, [series]);

  return (
    <div>
      <PageHeader
        eyebrow="Sensitivity analysis"
        title="What-If Analysis"
        subtitle="Sweep one parameter while everything else stays fixed, repeating each value over several seeds so effects can be separated from noise."
      />
      <BackendGate>
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <div className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
            <ConfigPanel />
          </div>
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Parameter to sweep" value={param}
                  onChange={(p) => { setParam(p); setValuesText(SUGGESTED[p] ?? ""); }}
                  options={Object.entries(defaults?.sensitivity_parameters ?? {}).map(([k, l]) => ({ value: k, label: l }))} />
                <TextField label="Values (comma separated)" value={valuesText} onChange={setValuesText}
                  hint={param === "network.loss_probability" ? "loss as a fraction: 0.01 = 1%" : undefined} />
                <NumberField label="Seeds per value" min={1} max={100} value={nTrials} onChange={setNTrials} />
                <SelectField label="Metric to plot" value={metric} onChange={setMetric}
                  options={Object.entries(METRIC_LABELS).map(([k, v]) => ({ value: k, label: v.label }))} />
              </div>
              <div className="mt-4">
                <Button onClick={() => void run()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                  Run sweep
                </Button>
              </div>
            </Card>
            <ErrorNote message={err} />

            {!res && !busy && (
              <Callout variant="note" title="Reading the result">
                Each point is the mean over seeds with a 95% confidence interval. If the intervals of two
                values overlap, the simulator has not shown a reliable difference between them at this number
                of seeds.
              </Callout>
            )}

            {res && (
              <>
                <Card>
                  <p className="mb-2 text-xs font-medium text-text-muted">
                    {METRIC_LABELS[metric]?.label ?? metric} vs {res.parameter_label} — mean ± 95% CI over{" "}
                    {res.n_trials} seeds ({res.protocol.toUpperCase()}-like, {res.abr} ABR)
                  </p>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={series}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="value" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} width={44} />
                      <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))} />
                      <Bar dataKey="mean" fill="#e5222b" fillOpacity={0.25} isAnimationActive={false} />
                      <Line dataKey="mean" stroke="#e5222b" strokeWidth={2} isAnimationActive={false}>
                        <ErrorBar dataKey="err" stroke="var(--color-text)" />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>

                {effect && (
                  <Card>
                    <p className="text-sm text-text-muted">
                      Across the swept range, the mean {METRIC_LABELS[metric]?.label ?? metric} moved from{" "}
                      <strong className="text-text">{fmt(effect.first.mean, 2)}</strong> at {effect.first.value} to{" "}
                      <strong className="text-text">{fmt(effect.last.mean, 2)}</strong> at {effect.last.value}; the
                      best mean was at <strong className="text-text">{effect.best.value}</strong>.{" "}
                      {effect.overlap
                        ? "The end-point confidence intervals overlap, so this sweep does not show a reliable end-to-end effect on this metric."
                        : "The end-point confidence intervals do not overlap."}{" "}
                      Interior points may be non-monotonic: ABR and transport interactions legitimately produce
                      exceptions.
                    </p>
                  </Card>
                )}

                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-left text-xs">
                      <thead className="bg-surface-alt text-text-muted">
                        <tr>{["Value", "QoE", "Avg bitrate", "Startup s", "Rebuffer s", "Switches", "Goodput", "n"].map((h) => (
                          <th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr>
                      </thead>
                      <tbody>
                        {res.points.map((p) => (
                          <tr key={p.value} className="border-t border-border">
                            <td className="px-3 py-1.5 font-semibold">{p.value}</td>
                            {p.error ? (
                              <td colSpan={7} className="px-3 py-1.5 text-error">{p.error}</td>
                            ) : (
                              ["qoe", "avg_bitrate_mbps", "startup_delay_s", "rebuffer_s", "bitrate_switches",
                                "mean_throughput_mbps"].map((k) => (
                                <td key={k} className="px-3 py-1.5 tabular-nums">
                                  {fmt(p.summary![k].mean)} ± {fmt(p.summary![k].ci_half_width)}
                                </td>
                              ))
                            )}
                            {!p.error && <td className="px-3 py-1.5">{p.n_ok}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4">
                    <ExportButtons items={[
                      { label: "Sweep JSON", format: "json", filename: `sensitivity-${res.parameter}`, data: res },
                      { label: "Sweep CSV", format: "csv", filename: `sensitivity-${res.parameter}`,
                        rows: res.points.filter((p) => p.summary).map((p) => ({
                          parameter: res.parameter, value: p.value, n: p.n_ok,
                          ...Object.fromEntries(Object.entries(p.summary!).flatMap(([k, s]) => [
                            [`${k}.mean`, s.mean], [`${k}.ci_low`, s.ci_low], [`${k}.ci_high`, s.ci_high]])),
                        })) },
                    ]} />
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </BackendGate>
    </div>
  );
}
