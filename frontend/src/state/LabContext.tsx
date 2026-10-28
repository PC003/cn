import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { DefaultsResponse, Metrics, SessionResult, SimConfig } from "../types/sim";

export interface HistoryEntry {
  id: string;
  time: string;
  label: string;
  config: SimConfig;
  metrics: Metrics;
}

interface LabState {
  defaults: DefaultsResponse | null;
  defaultsError: string | null;
  config: SimConfig | null;
  setConfig: (c: SimConfig) => void;
  resetConfig: () => void;
  result: SessionResult | null;
  setResult: (r: SessionResult | null) => void;
  running: boolean;
  error: string | null;
  run: (configOverride?: SimConfig) => Promise<SessionResult | null>;
  history: HistoryEntry[];
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  loadFromHistory: (id: string) => void;
}

const LabContext = createContext<LabState | null>(null);
const HISTORY_KEY = "ntl-experiment-history-v1";
const MAX_HISTORY = 50;

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(h: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {
    /* storage unavailable: history is a convenience only */
  }
}

export function LabProvider({ children }: { children: ReactNode }) {
  const [defaults, setDefaults] = useState<DefaultsResponse | null>(null);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  const [config, setConfig] = useState<SimConfig | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(readHistory);

  useEffect(() => {
    let cancelled = false;
    api
      .defaults()
      .then((d) => {
        if (cancelled) return;
        setDefaults(d);
        setConfig((c) => c ?? d.config);
      })
      .catch((e: Error) => {
        if (!cancelled) setDefaultsError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(
    async (override?: SimConfig) => {
      const cfg = override ?? config;
      if (!cfg) return null;
      setRunning(true);
      setError(null);
      try {
        const res = await api.simulate(cfg);
        setResult(res);
        const entry: HistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: new Date().toISOString(),
          label: `${res.transport_label.split(" ")[0]} · ${cfg.abr.strategy} · seed ${cfg.seed}`,
          config: cfg,
          metrics: res.metrics,
        };
        setHistory((h) => {
          const next = [entry, ...h].slice(0, MAX_HISTORY);
          writeHistory(next);
          return next;
        });
        return res;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [config],
  );

  const value = useMemo<LabState>(
    () => ({
      defaults,
      defaultsError,
      config,
      setConfig,
      resetConfig: () => defaults && setConfig(defaults.config),
      result,
      setResult,
      running,
      error,
      run,
      history,
      removeHistory: (id) =>
        setHistory((h) => {
          const next = h.filter((e) => e.id !== id);
          writeHistory(next);
          return next;
        }),
      clearHistory: () => {
        writeHistory([]);
        setHistory([]);
      },
      loadFromHistory: (id) => {
        const e = history.find((x) => x.id === id);
        if (e) setConfig(e.config);
      },
    }),
    [defaults, defaultsError, config, result, running, error, run, history],
  );

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

export function useLab(): LabState {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab must be used inside LabProvider");
  return ctx;
}
