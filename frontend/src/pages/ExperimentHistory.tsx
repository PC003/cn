import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { Button } from "../components/Field";
import { ExportButtons } from "../components/ExportButtons";
import { useLab } from "../state/LabContext";
import { fmt } from "../utils/format";

export default function ExperimentHistory() {
  const { history, removeHistory, clearHistory, loadFromHistory } = useLab();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const chosen = history.filter((h) => selected.includes(h.id));

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-4)));

  return (
    <div>
      <PageHeader
        eyebrow="Reproducibility"
        title="Experiment History"
        subtitle="Sessions run in this browser, stored locally with their full configuration and seed so any of them can be reproduced exactly."
        actions={history.length > 0 ? <Button variant="ghost" onClick={clearHistory}>Clear all</Button> : undefined}
      />
      {history.length === 0 ? (
        <Callout variant="note" title="No stored experiments">
          Run a session in the <Link to="/experiment-lab" className="text-accent underline">Experiment Lab</Link>;
          it will be recorded here (browser local storage — never uploaded).
        </Callout>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-xs">
                <thead className="bg-surface-alt text-text-muted">
                  <tr>{["Compare", "When", "Run", "QoE", "Avg Mbps", "Startup s", "Rebuffer s", "Switches", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>))}</tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={selected.includes(h.id)} onChange={() => toggle(h.id)}
                          aria-label={`Select ${h.label}`} />
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-text-muted">
                        {new Date(h.time).toLocaleString()}</td>
                      <td className="px-3 py-1.5">{h.label}</td>
                      <td className="px-3 py-1.5 tabular-nums font-semibold">{fmt(h.metrics.qoe, 1)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmt(h.metrics.avg_bitrate_mbps)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmt(h.metrics.startup_delay_s)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmt(h.metrics.rebuffer_s)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{h.metrics.bitrate_switches}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <button className="mr-2 inline-flex items-center gap-1 text-accent"
                          onClick={() => { loadFromHistory(h.id); navigate("/experiment-lab"); }}>
                          <Copy className="h-3.5 w-3.5" /> Duplicate
                        </button>
                        <button className="text-text-muted hover:text-error" aria-label="Delete"
                          onClick={() => removeHistory(h.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {chosen.length >= 2 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Side-by-side (up to 4 selected)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-text-muted">
                    <tr><th className="py-2 text-left font-medium">Metric</th>
                      {chosen.map((c) => <th key={c.id} className="px-3 py-2 text-left font-medium">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {([["QoE", "qoe"], ["Avg bitrate Mbps", "avg_bitrate_mbps"], ["Startup s", "startup_delay_s"],
                      ["Rebuffer s", "rebuffer_s"], ["Switches", "bitrate_switches"],
                      ["Retransmissions", "retransmissions"], ["Timeouts", "timeouts"],
                      ["HOL pkt·s", "hol_blocked_packet_s"]] as const).map(([label, key]) => (
                      <tr key={key} className="border-t border-border">
                        <td className="py-1.5 text-text-muted">{label}</td>
                        {chosen.map((c) => <td key={c.id} className="px-3 py-1.5 tabular-nums">
                          {fmt(c.metrics[key] as number)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <ExportButtons items={[
              { label: "History JSON (with configs)", format: "json", filename: "experiment-history", data: history },
              { label: "History CSV (metrics)", format: "csv", filename: "experiment-history",
                rows: history.map((h) => ({ id: h.id, time: h.time, label: h.label, ...h.metrics })) },
            ]} />
          </Card>
        </div>
      )}
    </div>
  );
}
