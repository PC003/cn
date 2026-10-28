import { useState } from "react";
import { Loader2, GitCompare } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { ConfigPanel } from "../components/ConfigPanel";
import { BackendGate, ErrorNote } from "../components/Notices";
import { Button, NumberField } from "../components/Field";
import { ExportButtons } from "../components/ExportButtons";
import { useLab } from "../state/LabContext";
import { api } from "../services/api";
import type { CompareSingle, CompareTrials, Metrics, Protocol, UdpRecovery } from "../types/sim";
import { fmt, pm } from "../utils/format";

const PALETTE = ["#e5222b", "#0f6fde", "#8250df", "#d68a00", "#147a3f", "#00838f"];

interface Row {
  label: string;
  metrics: Metrics | null; // single run
  trialSummary: CompareTrials["variants"][number] | null; // repeated
}

const TABLE: { key: keyof Metrics; label: string; digits: number }[] = [
  { key: "qoe", label: "QoE score", digits: 1 },
  { key: "avg_bitrate_mbps", label: "Avg bitrate (Mbps)", digits: 2 },
  { key: "startup_delay_s", label: "Startup delay (s)", digits: 2 },
  { key: "rebuffer_s", label: "Rebuffering (s)", digits: 2 },
  { key: "rebuffer_events", label: "Rebuffer events", digits: 0 },
  { key: "bitrate_switches", label: "Bitrate switches", digits: 0 },
  { key: "mean_throughput_mbps", label: "Goodput (Mbps)", digits: 2 },
  { key: "mean_download_s", label: "Segment download (s)", digits: 2 },
  { key: "retransmissions", label: "Retransmissions", digits: 0 },
  { key: "timeouts", label: "Timeouts", digits: 0 },
  { key: "hol_blocked_packet_s", label: "HOL blocking (pkt·s)", digits: 1 },
  { key: "reordered_packets", label: "Reordered packets", digits: 0 },
  { key: "incomplete_segments", label: "Incomplete segments", digits: 0 },
  { key: "mean_delivered_fraction", label: "Delivered fraction", digits: 4 },
];

export default function TcpVsUdp() {
  const { config } = useLab();
  const [protocols, setProtocols] = useState<Record<Protocol, boolean>>({ tcp: true, udp: true, quic: true });
  const [recoveries, setRecoveries] = useState<Record<UdpRecovery, boolean>>({ none: true, arq: true, fec: false });
  const [nTrials, setNTrials] = useState(1);
  const [single, setSingle] = useState<CompareSingle | null>(null);
  const [multi, setMulti] = useState<CompareTrials | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!config) return;
    const protos = (Object.keys(protocols) as Protocol[]).filter((p) => protocols[p]);
    const recs = (Object.keys(recoveries) as UdpRecovery[]).filter((r) => recoveries[r]);
    if (protos.length === 0) return setErr("Select at least one protocol.");
    setBusy(true);
    setErr(null);
    try {
      const res = await api.compare(config, protos, protos.includes("udp") ? recs : null, nTrials);
      if ("runs" in res) {
        setSingle(res);
        setMulti(null);
      } else {
        setMulti(res);
        setSingle(null);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rows: Row[] = single
    ? single.runs.map((r) => ({ label: r.label, metrics: r.result.metrics, trialSummary: null }))
    : multi
      ? multi.variants.map((v) => ({ label: v.label ?? v.protocol, metrics: null, trialSummary: v }))
      : [];

  // Overlay of buffer / bitrate for single runs, merged on the common time grid.
  const overlay = single
    ? (() => {
        const maxLen = Math.max(...single.runs.map((r) => r.result.timeline.length));
        return Array.from({ length: maxLen }, (_, i) => {
          const row: Record<string, number> = {};
          single.runs.forEach((r, k) => {
            const p = r.result.timeline[Math.min(i, r.result.timeline.length - 1)];
            row.t = single.runs[0].result.timeline[Math.min(i, single.runs[0].result.timeline.length - 1)].t;
            row[`buf${k}`] = p.buffer_s;
            row[`br${k}`] = p.playing_bitrate_mbps;
          });
          return row;
        });
      })()
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Controlled experiment"
        title="TCP vs UDP vs QUIC"
        subtitle="Identical bandwidth trace, loss draws, jitter, ladder, ABR and seed — only the transport differs. Set trials > 1 to repeat over seeds with 95% confidence intervals."
      />
      <BackendGate>
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-end gap-6">
              <fieldset>
                <legend className="mb-1 text-xs text-text-muted">Transports</legend>
                <div className="flex gap-3 text-sm">
                  {(["tcp", "udp", "quic"] as Protocol[]).map((p) => (
                    <label key={p} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={protocols[p]}
                        onChange={(e) => setProtocols({ ...protocols, [p]: e.target.checked })} />
                      {p.toUpperCase()}-like
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className={protocols.udp ? "" : "opacity-40"}>
                <legend className="mb-1 text-xs text-text-muted">UDP application recovery variants</legend>
                <div className="flex gap-3 text-sm">
                  {(["none", "arq", "fec"] as UdpRecovery[]).map((r) => (
                    <label key={r} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={recoveries[r]} disabled={!protocols.udp}
                        onChange={(e) => setRecoveries({ ...recoveries, [r]: e.target.checked })} />
                      {r}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="w-28">
                <NumberField label="Trials (1 = single seed)" min={1} max={100} value={nTrials} onChange={setNTrials} />
              </div>
              <Button onClick={() => void run()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
                Run comparison
              </Button>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-accent">
                Network / video / ABR settings (shared with Experiment Lab)
              </summary>
              <div className="mt-3 max-w-xl"><ConfigPanel show={["network", "video", "abr"]} /></div>
            </details>
          </Card>

          <ErrorNote message={err} />

          {rows.length === 0 && !busy && (
            <Callout variant="note" title="Nothing run yet">
              Choose transports and press <strong>Run comparison</strong>. The same seed drives the bandwidth trace
              and the first-transmission loss draws for every transport, so differences come from transport
              behaviour alone. Do not expect UDP or TCP to always win — the result depends on loss, RTT,
              bandwidth and UDP&apos;s recovery policy.
            </Callout>
          )}

          {rows.length > 0 && (
            <>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="text-xs text-text-muted">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Metric</th>
                        {rows.map((r, i) => (
                          <th key={r.label} className="px-3 py-2 font-semibold" style={{ color: PALETTE[i % PALETTE.length] }}>
                            {r.label.toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TABLE.map((t) => (
                        <tr key={t.key} className="border-t border-border">
                          <td className="py-1.5 pr-4 text-text-muted">{t.label}</td>
                          {rows.map((r) => {
                            if (r.metrics) {
                              return <td key={r.label} className="px-3 py-1.5 tabular-nums">
                                {fmt(r.metrics[t.key] as number, t.digits)}</td>;
                            }
                            const s = r.trialSummary?.summary[t.key];
                            return <td key={r.label} className="px-3 py-1.5 tabular-nums">
                              {s ? pm(s.mean, s.ci_half_width, t.digits === 0 ? 1 : t.digits) : "—"}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[11px] text-text-muted">
                  {single
                    ? `Single run, seed ${single.seed}. Rebuffering is zero for many seeds, so single runs can mislead — use trials.`
                    : `Mean ± 95% CI half-width over ${multi?.n_trials} seeds (Student t).`}
                </p>
              </Card>

              {multi && (
                <Card>
                  <p className="mb-2 text-xs font-medium text-text-muted">QoE, mean ± 95% CI</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={multi.variants.map((v) => ({
                        name: (v.label ?? v.protocol).toUpperCase(),
                        qoe: v.summary.qoe.mean,
                        err: v.summary.qoe.ci_half_width ?? 0,
                      }))}
                    >
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                      <Tooltip />
                      <Bar dataKey="qoe" fill="#e5222b" isAnimationActive={false}>
                        <ErrorBar dataKey="err" stroke="var(--color-text)" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {single && (
                <Card>
                  <p className="mb-2 text-xs font-medium text-text-muted">Playback buffer (s) over time, same trace</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={overlay}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} unit="s"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} width={36} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {single.runs.map((r, k) => (
                        <Line key={r.label} dataKey={`buf${k}`} name={r.label} dot={false} strokeWidth={2}
                          stroke={PALETTE[k % PALETTE.length]} isAnimationActive={false} />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                  <p className="mb-2 mt-5 text-xs font-medium text-text-muted">Playing bitrate (Mbps)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={overlay}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} unit="s"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} width={36} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {single.runs.map((r, k) => (
                        <Line key={r.label} dataKey={`br${k}`} name={r.label} dot={false} strokeWidth={2}
                          type="stepAfter" stroke={PALETTE[k % PALETTE.length]} isAnimationActive={false} />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {single && <Explanation single={single} />}

              <Card>
                <ExportButtons items={[
                  { label: "Comparison JSON", format: "json", filename: "transport-comparison",
                    data: single ?? multi },
                  { label: "Metrics CSV", format: "csv", filename: "transport-comparison",
                    rows: single
                      ? single.runs.map((r) => ({ label: r.label, ...r.result.metrics }))
                      : (multi?.variants ?? []).map((v) => ({
                          label: v.label,
                          n_ok: v.n_ok,
                          ...Object.fromEntries(Object.entries(v.summary).flatMap(([k, s]) => [
                            [`${k}.mean`, s.mean], [`${k}.std`, s.std],
                            [`${k}.ci_low`, s.ci_low], [`${k}.ci_high`, s.ci_high],
                          ])),
                        })) },
                ]} />
              </Card>
            </>
          )}
        </div>
      </BackendGate>
    </div>
  );
}

/** Explanations assembled from the measured numbers of this run; nothing is canned. */
function Explanation({ single }: { single: CompareSingle }) {
  const by = (label: string) => single.runs.find((r) => r.label === label)?.result.metrics;
  const tcp = by("tcp");
  const quic = by("quic");
  const quicStreams = single.runs.find((r) => r.label === "quic")?.result.config.transport.quic_streams ?? 4;
  const lines: string[] = [];
  if (tcp) {
    lines.push(
      `TCP-like recovered ${tcp.retransmissions} lost packets (${tcp.fast_retransmits} fast retransmits, ` +
        `${tcp.timeouts} timeouts). Packets that arrived behind a hole waited ${fmt(tcp.hol_blocked_packet_s, 1)} ` +
        `packet·seconds in the reorder buffer — head-of-line blocking.`,
    );
  }
  if (tcp && quic) {
    lines.push(
      `QUIC-like used the same loss recovery but with ${quicStreams} independent streams: HOL waiting fell to ` +
        `${fmt(quic.hol_blocked_packet_s, 1)} packet·s, with a ${fmt(quic.startup_delay_s)}s startup versus ` +
        `${fmt(tcp.startup_delay_s)}s for TCP-like (1 vs 2 handshake round trips).`,
    );
  }
  single.runs
    .filter((r) => r.protocol === "udp")
    .forEach((r) => {
      const m = r.result.metrics;
      const rec = r.result.config.transport.udp_recovery;
      lines.push(
        `${r.label}: no transport retransmission. ${m.incomplete_segments} of ${m.segments} segments arrived ` +
          `incomplete (mean delivered fraction ${fmt(m.mean_delivered_fraction, 4)}) ` +
          (rec === "arq"
            ? `after ${m.retransmissions} application-level repairs, which cost extra round trips.`
            : rec === "fec"
              ? `even with parity packets; FEC only repairs blocks with few enough losses.`
              : `because nothing repairs gaps; quality is damaged instead of delayed.`),
      );
    });
  const best = [...single.runs].sort((a, b) => b.result.metrics.qoe - a.result.metrics.qoe)[0];
  lines.push(`Highest QoE in this run: ${best.label} (${fmt(best.result.metrics.qoe, 1)}). One seed is anecdotal — repeat over seeds before concluding.`);
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold">What the measurements show</h2>
      <ul className="space-y-2 text-sm text-text-muted">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2"><span className="text-primary">›</span><span>{l}</span></li>
        ))}
      </ul>
    </Card>
  );
}
