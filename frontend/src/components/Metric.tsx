import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: "default" | "good" | "bad";
}) {
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-error" : "text-text";
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}
