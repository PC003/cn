import type { TrialsResult } from "../types/sim";
import { fmt } from "../utils/format";
import { METRIC_LABELS } from "../utils/metrics";


export function TrialsTable({ trials, metrics }: { trials: TrialsResult; metrics?: string[] }) {
  const keys = metrics ?? Object.keys(METRIC_LABELS);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-left text-xs">
          <thead className="bg-surface-alt text-text-muted">
            <tr>
              {["Metric", "Mean", "Std dev", "95% CI low", "95% CI high", "Min", "Max", "n"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const s = trials.summary[k];
              if (!s) return null;
              const d = METRIC_LABELS[k]?.digits ?? 2;
              return (
                <tr key={k} className="border-t border-border">
                  <td className="px-3 py-1.5">{METRIC_LABELS[k]?.label ?? k}</td>
                  <td className="px-3 py-1.5 font-semibold tabular-nums">{fmt(s.mean, d)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(s.std, d)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(s.ci_low, d)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(s.ci_high, d)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(s.min, d)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(s.max, d)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-text-muted">
        {trials.n_ok} of {trials.n_requested} runs completed (seeds {trials.base_seed}–
        {trials.base_seed + trials.n_requested - 1}). Excluded runs:{" "}
        {trials.excluded.length === 0
          ? "none"
          : trials.excluded.map((e) => `seed ${e.seed}: ${e.reason}`).join("; ")}
        . CI method: {trials.ci_method}.
      </p>
    </div>
  );
}
