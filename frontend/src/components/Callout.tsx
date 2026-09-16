import type { ReactNode } from "react";
import { Info, AlertTriangle, FlaskConical } from "lucide-react";

type Variant = "note" | "warning" | "simulation";

const CONFIG: Record<Variant, { icon: typeof Info; classes: string }> = {
  note: { icon: Info, classes: "border-accent/30 bg-accent/5 text-text" },
  warning: { icon: AlertTriangle, classes: "border-warning/40 bg-warning-bg text-text" },
  simulation: { icon: FlaskConical, classes: "border-primary/30 bg-primary/5 text-text" },
};

/**
 * Inline disclosure box used throughout the app to flag simplified /
 * simulated behaviour so claims are never mistaken for Netflix's real stack.
 */
export function Callout({
  variant = "note",
  title,
  children,
}: {
  variant?: Variant;
  title: string;
  children: ReactNode;
}) {
  const { icon: Icon, classes } = CONFIG[variant];
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-text-muted">{children}</div>
      </div>
    </div>
  );
}
