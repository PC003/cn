import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { MetricCard } from "../components/Metric";
import { SessionCharts } from "../components/SessionCharts";
import { SegmentTable } from "../components/SegmentTable";
import { EventLog } from "../components/EventLog";
import { ExportButtons } from "../components/ExportButtons";
import { BackendGate } from "../components/Notices";
import { useLab } from "../state/LabContext";
import { fmt } from "../utils/format";

export default function Results() {
  const { result } = useLab();

  return (
    <div>
      <PageHeader
        eyebrow="Measured output"
        title="Results"
        subtitle="QoE dashboard, per-segment log, event log and export for the most recent session."
      />
      <BackendGate>
        {!result ? (
          <Callout variant="note" title="No session yet">
            Run one from the <Link to="/experiment-lab" className="text-accent underline">Experiment Lab</Link>.
          </Callout>
        ) : (
          <ResultsBody />
        )}
      </BackendGate>
    </div>
  );
}

function ResultsBody() {
  const { result } = useLab();
  if (!result) return null;
  const m = result.metrics;
  const q = result.qoe;
  const comps = [
    { name: "Quality", value: q.quality_term, fill: "#147a3f" },
    { name: "− Rebuffering", value: -q.rebuffer_penalty, fill: "#e5222b" },
    { name: "− Startup", value: -q.startup_penalty, fill: "#d68a00" },
    { name: "− Switching", value: -q.switch_penalty, fill: "#8250df" },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">
        {result.transport_label} · {m.abr}-based ABR · seed {m.seed} · {m.segments} segments ·
        session {fmt(m.session_time_s, 1)}s
      </p>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="QoE" value={fmt(q.score, 1)} unit="/100" hint={`raw ${fmt(q.raw_score, 1)}`} />
        <MetricCard label="Avg bitrate" value={fmt(m.avg_bitrate_mbps)} unit="Mbps" />
        <MetricCard label="Startup" value={fmt(m.startup_delay_s)} unit="s" />
        <MetricCard label="Rebuffering" value={fmt(m.rebuffer_s)} unit="s"
          hint={`${m.rebuffer_events} event(s), ratio ${(m.rebuffer_ratio * 100).toFixed(2)}%`}
          tone={m.rebuffer_s > 0 ? "bad" : "good"} />
        <MetricCard label="Switches" value={m.bitrate_switches}
          hint={`mean step ${fmt(m.mean_switch_magnitude_mbps)} Mbps`} />
        <MetricCard label="Goodput" value={fmt(m.mean_throughput_mbps)} unit="Mbps" />
        <MetricCard label="Packets lost" value={m.packets_lost} hint={`of ${m.packets_sent} sent`} />
        <MetricCard label="Retransmissions" value={m.retransmissions}
          hint={`${m.timeouts} RTO, ${m.fast_retransmits} fast`} />
        <MetricCard label="HOL blocking" value={fmt(m.hol_blocked_packet_s, 1)} unit="pkt·s" />
        <MetricCard label="Incomplete segs" value={m.incomplete_segments}
          hint={`delivered ${(m.mean_delivered_fraction * 100).toFixed(2)}%`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-sm font-semibold">QoE breakdown</h2>
          <p className="mb-3 text-[11px] text-text-muted">
            score = clamp(quality − rebuffering − startup − switching, 0, 100). Weights are configurable.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comps} layout="vertical" margin={{ left: 20, right: 16 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
              <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
              <Bar dataKey="value" isAnimationActive={false}>
                {comps.map((c) => <Cell key={c.name} fill={c.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Weights used</h2>
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(q.weights).map(([k, v]) => (
                <tr key={k} className="border-t border-border">
                  <td className="py-1.5 font-mono text-text-muted">{k}</td>
                  <td className="py-1.5 text-right tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-text-muted">
            Simplified educational score, not an industry-standard metric.
          </p>
        </Card>
      </div>

      <Card><SessionCharts result={result} /></Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Segment log (downloads and ABR decisions)</h2>
        <SegmentTable segments={result.segments} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Event log</h2>
        <EventLog events={result.events} />
      </Card>

      {result.packet_trace.length > 0 && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold">Packet trace (segment 0, first packets)</h2>
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-alt text-text-muted">
                <tr>{["#", "seq", "sent s", "arrived s", "lost", "retx", "in order"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>))}</tr>
              </thead>
              <tbody>
                {result.packet_trace.map((p) => (
                  <tr key={p.packet_id} className={`border-t border-border ${p.lost ? "text-error" : ""}`}>
                    <td className="px-2 py-1">{p.packet_id}</td><td className="px-2 py-1">{p.seq}</td>
                    <td className="px-2 py-1 tabular-nums">{p.send_time.toFixed(4)}</td>
                    <td className="px-2 py-1 tabular-nums">{p.arrival_time === null ? "—" : p.arrival_time.toFixed(4)}</td>
                    <td className="px-2 py-1">{p.lost ? "yes" : ""}</td>
                    <td className="px-2 py-1">{p.retransmitted ? "yes" : ""}</td>
                    <td className="px-2 py-1">{p.delivered ? (p.in_order ? "yes" : "held (HOL)") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Export</h2>
        <ExportButtons items={[
          { label: "Full result JSON", format: "json", filename: `session-seed${m.seed}`, data: result },
          { label: "Segments CSV", format: "csv", filename: `segments-seed${m.seed}`,
            rows: result.segments as unknown as Record<string, unknown>[] },
          { label: "Events CSV", format: "csv", filename: `events-seed${m.seed}`,
            rows: result.events as unknown as Record<string, unknown>[] },
          { label: "Timeline CSV", format: "csv", filename: `timeline-seed${m.seed}`,
            rows: result.timeline as unknown as Record<string, unknown>[] },
        ]} />
        <p className="mt-3 text-[11px] text-text-muted">
          The JSON includes the full configuration and seed, so the run can be reproduced exactly.
        </p>
      </Card>
    </div>
  );
}
