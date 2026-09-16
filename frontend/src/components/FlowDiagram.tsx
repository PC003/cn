import { ChevronRight, ChevronDown } from "lucide-react";
import { Fragment } from "react";

/**
 * Simple horizontal/vertical step-flow diagram used across the app for
 * conceptual pipelines (architecture, request flow, etc). Purely
 * illustrative — not a live data visualization.
 */
export function FlowDiagram({
  steps,
  direction = "horizontal",
}: {
  steps: { label: string; hint?: string }[];
  direction?: "horizontal" | "vertical";
}) {
  const Arrow = direction === "horizontal" ? ChevronRight : ChevronDown;
  return (
    <div
      className={`flex ${
        direction === "horizontal" ? "flex-row flex-wrap items-center" : "flex-col items-stretch"
      } gap-2`}
    >
      {steps.map((step, i) => (
        <Fragment key={step.label}>
          <div className="flex min-w-[9rem] flex-1 flex-col items-center gap-0.5 rounded-lg border border-border bg-surface-alt px-3 py-3 text-center">
            <span className="text-sm font-semibold">{step.label}</span>
            {step.hint && <span className="text-xs text-text-muted">{step.hint}</span>}
          </div>
          {i < steps.length - 1 && <Arrow className="mx-auto h-5 w-5 shrink-0 text-text-muted" />}
        </Fragment>
      ))}
    </div>
  );
}
