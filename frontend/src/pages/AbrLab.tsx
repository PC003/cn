import { useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { ConfigPanel } from "../components/ConfigPanel";
import { BackendGate, ErrorNote } from "../components/Notices";
import { Button, NumberField } from "../components/Field";
import { ExportButtons } from "../components/ExportButtons";
import { TrialsTable } from "../components/TrialsTable";
import { SegmentTable } from "../components/SegmentTable";
import { useLab } from "../state/LabContext";
import { api } from "../services/api";
import type { AbrCompare } from "../types/sim";
import { fmt } from "../utils/format";

const COLORS: Record<string, string> = { throughput: "#e5222b", buffer: "#0f6fde" };
const NAME: Record<string, string> = { throughput: "Throughput-based", buffer: "Buffer-based" };

export default function AbrLab() {
  const { config } = useLab();
  const [nTrials, setNTrials] = useState(1);
  const [res, setRes] = useState<AbrCompare | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!config) return;
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.abrCompare(config, nTrials));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const singles = res?.runs.filter((r) => r.result) ?? [];
  const overlay = singles.length
    ? (() => {
        const base = singles[0].result!.timeline;
        return base.map((p, i) => {
          const row: Record<string, number> = { t: p.t, bandwidth: p.bandwidth_mbps };
          singles.forEach((r) => {
            const tl = r.result!.timeline;
            const q = tl[Math.min(i, tl.length - 1)];
            row[`br_${r.strategy}`] = q.playing_bitrate_mbps;
            row[`buf_${r.strategy}`] = q.buffer_s;
          });
          return row;
        });
      })()
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Adaptive bitrate"
        title="ABR Lab"
        subtitle="Throughput-based and buffer-based ABR on the same network trace, with the rule and reason logged for every segment."
      />
      <BackendGate>
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <div className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
            <ConfigPanel show={["network", "transport", "video", "abr"]} />
          </div>
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-32">
                  <NumberField label="Trials (1 = single seed)" min={1} max={100} value={nTrials} onChange={setNTrials} />
                </div>
                <Button onClick={() => void run()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
                  Compare ABR strategies
                </Button>
                <p className="basis-full text-[11px] text-text-muted">
                  Uses the transport and network on the left; the ABR strategy field is overridden for each of the
                  two runs. Throughput ABR uses the safety factor and estimator window; buffer ABR uses reservoir
                  and cushion.
                </p>
              </div>
            </Card>
            <ErrorNote message={err} />

            {!res && !busy && (
              <Callout variant="note" title="How they differ">
                Throughput-based ABR reacts to what the last segments measured, so it follows the network
                quickly but inherits noise (and, under loss, TCP&apos;s depressed throughput). Buffer-based ABR
                ignores throughput and reacts to buffer occupancy, which is smoother but slow to
                react to sudden drops when the buffer is full. Try the &ldquo;sudden drop&rdquo; preset.
              </Callout>
            )}

            {singles.length > 0 && (
              <>
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-text-muted">
                        <tr><th className="py-2 text-left font-medium">Metric</th>
                          {singles.map((r) => (
                            <th key={r.strategy} className="px-3 py-2 text-left" style={{ color: COLORS[r.strategy] }}>
                              {NAME[r.strategy]}
                            </th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          ["QoE score", "qoe", 1], ["Avg bitrate (Mbps)", "avg_bitrate_mbps", 2],
                          ["Startup delay (s)", "startup_delay_s", 2], ["Rebuffering (s)", "rebuffer_s", 2],
                          ["Rebuffer events", "rebuffer_events", 0], ["Bitrate switches", "bitrate_switches", 0],
                          ["Mean buffer (s)", "mean_buffer_s", 1],
                        ] as const).map(([label, key, d]) => (
                          <tr key={key} className="border-t border-border">
                            <td className="py-1.5 text-text-muted">{label}</td>
                            {singles.map((r) => (
                              <td key={r.strategy} className="px-3 py-1.5 tabular-nums">
                                {fmt(r.result!.metrics[key] as number, d)}</td>))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Card>
                  <p className="mb-1 text-xs font-medium text-text-muted">Selected bitrate and network bandwidth (Mbps)</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={overlay}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} unit="s"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} width={36} />
                      <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line dataKey="bandwidth" name="Bandwidth" stroke="#8b94a3" strokeDasharray="4 3"
                        dot={false} type="stepAfter" isAnimationActive={false} />
                      {singles.map((r) => (
                        <Line key={r.strategy} dataKey={`br_${r.strategy}`} name={NAME[r.strategy]}
                          stroke={COLORS[r.strategy]} strokeWidth={2} dot={false} type="stepAfter"
                          isAnimationActive={false} />))}
                    </ComposedChart>
                  </ResponsiveContainer>
                  <p className="mb-1 mt-5 text-xs font-medium text-text-muted">Playback buffer (s)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={overlay}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} unit="s"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} width={36} />
                      <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                      {singles.map((r) => (
                        <Line key={r.strategy} dataKey={`buf_${r.strategy}`} name={NAME[r.strategy]}
                          stroke={COLORS[r.strategy]} strokeWidth={2} dot={false} isAnimationActive={false} />))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
                {singles.map((r) => (
                  <Card key={r.strategy}>
                    <h3 className="mb-2 text-sm font-semibold">{NAME[r.strategy]} — decision log</h3>
                    <SegmentTable segments={r.result!.segments} maxHeight="20rem" />
                  </Card>
                ))}
              </>
            )}

            {res?.runs.filter((r) => r.trials).map((r) => (
              <Card key={r.strategy}>
                <h3 className="mb-2 text-sm font-semibold">{NAME[r.strategy]} — {res.n_trials} seeds</h3>
                <TrialsTable trials={r.trials!} metrics={["qoe", "avg_bitrate_mbps", "startup_delay_s",
                  "rebuffer_s", "rebuffer_events", "bitrate_switches"]} />
              </Card>
            ))}

            {res && <Card><ExportButtons items={[
              { label: "ABR comparison JSON", format: "json", filename: "abr-comparison", data: res },
            ]} /></Card>}
          </div>
        </div>
      </BackendGate>
    </div>
  );
}
