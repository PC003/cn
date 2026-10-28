import { useState } from "react";
import { Download } from "lucide-react";
import { api } from "../services/api";
import { Button } from "./Field";

export interface ExportItem {
  label: string;
  format: "json" | "csv";
  filename: string;
  data?: unknown;
  rows?: Record<string, unknown>[];
}

export function ExportButtons({ items }: { items: ExportItem[] }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <Button
          key={it.label}
          variant="secondary"
          onClick={() =>
            api
              .download(it.format, it.filename, { data: it.data, rows: it.rows })
              .then(() => setError(null))
              .catch((e: Error) => setError(e.message))
          }
        >
          <Download className="h-3.5 w-3.5" /> {it.label}
        </Button>
      ))}
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
