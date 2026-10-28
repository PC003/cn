export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function pm(mean: number | null, half: number | null, digits = 2): string {
  if (mean === null) return "—";
  if (half === null) return mean.toFixed(digits);
  return `${mean.toFixed(digits)} ± ${half.toFixed(digits)}`;
}

export function parseNumberList(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}
