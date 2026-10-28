import { Loader2 } from "lucide-react";
import { Callout } from "./Callout";
import { useLab } from "../state/LabContext";

/** Shown by every simulator page until the backend has delivered its default configuration. */
export function BackendGate({ children }: { children: React.ReactNode }) {
  const { config, defaultsError } = useLab();
  if (defaultsError) {
    return (
      <Callout variant="warning" title="Backend not reachable">
        The simulator runs in the Python backend. Start it with{" "}
        <code className="font-mono">uvicorn app.main:app --port 8000</code> from the{" "}
        <code className="font-mono">backend/</code> folder, then reload. ({defaultsError})
      </Callout>
    );
  }
  if (!config) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading simulator defaults…
      </p>
    );
  }
  return <>{children}</>;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-error/40 bg-error-bg px-4 py-3 text-sm text-error">{message}</div>
  );
}
