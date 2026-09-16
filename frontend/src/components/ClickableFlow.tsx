import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { Card } from "./Card";

export interface FlowNode {
  id: string;
  label: string;
  hint?: string;
  detail: string;
}

export function ClickableFlow({
  nodes,
  direction = "vertical",
}: {
  nodes: FlowNode[];
  direction?: "horizontal" | "vertical";
}) {
  const [activeId, setActiveId] = useState(nodes[0]?.id);
  const active = nodes.find((n) => n.id === activeId) ?? nodes[0];
  const Arrow = direction === "horizontal" ? ChevronRight : ChevronDown;

  return (
    <div className={`grid gap-4 ${direction === "horizontal" ? "" : "md:grid-cols-[1fr_1.1fr]"}`}>
      <div
        className={`flex ${
          direction === "horizontal" ? "flex-row flex-wrap items-center" : "flex-col items-stretch"
        } gap-2`}
      >
        {nodes.map((node, i) => (
          <Fragment key={node.id}>
            <button
              onClick={() => setActiveId(node.id)}
              className={`flex min-w-[9rem] flex-1 flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-center transition-colors ${
                node.id === active?.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-alt hover:border-primary/40"
              }`}
            >
              <span className="text-sm font-semibold">{node.label}</span>
              {node.hint && <span className="text-xs text-text-muted">{node.hint}</span>}
            </button>
            {i < nodes.length - 1 && <Arrow className="mx-auto h-5 w-5 shrink-0 text-text-muted" />}
          </Fragment>
        ))}
      </div>

      <Card className="bg-surface-alt">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{active?.label}</p>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{active?.detail}</p>
      </Card>
    </div>
  );
}
