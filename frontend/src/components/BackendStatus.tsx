import { Circle } from "lucide-react";
import { useBackendStatus } from "../hooks/useBackendStatus";

export function BackendStatus() {
  const { status } = useBackendStatus();

  const config = {
    checking: { color: "text-neutral", label: "Checking backend…" },
    online: { color: "text-success", label: "Backend connected" },
    offline: { color: "text-error", label: "Backend offline" },
  }[status];

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted">
      <Circle className={`h-2 w-2 fill-current ${config.color}`} strokeWidth={0} />
      <span>{config.label}</span>
    </div>
  );
}
