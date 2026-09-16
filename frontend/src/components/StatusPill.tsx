import type { PageStatus } from "../types/nav";

const STYLES: Record<PageStatus, string> = {
  ready: "bg-success-bg text-success",
  planned: "bg-warning-bg text-warning",
};

const LABELS: Record<PageStatus, string> = {
  ready: "Available",
  planned: "Planned",
};

export function StatusPill({ status }: { status: PageStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
