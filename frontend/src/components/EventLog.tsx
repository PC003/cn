import { useMemo, useState } from "react";
import type { SimEvent } from "../types/sim";

const TONE: Record<string, string> = {
  stall_start: "text-error",
  stall_end: "text-success",
  timeout: "text-warning",
  fast_retransmit: "text-warning",
  repair_round: "text-warning",
  incomplete_segment: "text-error",
  handshake_loss: "text-warning",
};

export function EventLog({
  events,
  upTo,
  maxHeight = "22rem",
}: {
  events: SimEvent[];
  upTo?: number;
  maxHeight?: string;
}) {
  const [filter, setFilter] = useState<string>("all");
  const types = useMemo(() => ["all", ...Array.from(new Set(events.map((e) => e.type)))], [events]);
  const shown = events.filter((e) => (filter === "all" || e.type === filter) && (upTo === undefined || e.t <= upTo));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${
              filter === t ? "border-primary bg-primary/10 text-primary" : "border-border text-text-muted"
            }`}
          >
            {t.replace(/_/g, " ")}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-text-muted">{shown.length} events</span>
      </div>
      <div className="overflow-auto rounded-lg border border-border bg-surface" style={{ maxHeight }}>
        <table className="w-full text-xs">
          <tbody>
            {shown.map((e, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="w-16 whitespace-nowrap px-2 py-1 font-mono text-text-muted">{e.t.toFixed(2)}s</td>
                <td className={`w-36 whitespace-nowrap px-2 py-1 font-mono ${TONE[e.type] ?? "text-accent"}`}>
                  {e.type}
                </td>
                <td className="px-2 py-1 text-text-muted">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
