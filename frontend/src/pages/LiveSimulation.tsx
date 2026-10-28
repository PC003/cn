import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Pause,
  Play,
  RotateCcw,
  Zap,
  Loader2,
  Tv,
  History,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { Button } from "../components/Field";
import { SessionCharts } from "../components/SessionCharts";
import { EventLog } from "../components/EventLog";
import { BackendGate, ErrorNote } from "../components/Notices";
import { InteractiveVideoLab } from "../components/InteractiveVideoLab";
import { useLab } from "../state/LabContext";
import type { Impairment, SimConfig } from "../types/sim";
import { fmt } from "../utils/format";

const SPEEDS = [0.5, 1, 2, 5, 10, 20];

const STATE_STYLE: Record<string, string> = {
  startup: "bg-warning-bg text-warning",
  playing: "bg-success-bg text-success",
  stalled: "bg-error-bg text-error",
  ended: "bg-neutral-bg text-neutral",
};

const INJECTIONS: { label: string; imp: Omit<Impairment, "start_s"> }[] = [
  { label: "Bandwidth −80%", imp: { duration_s: 15, bandwidth_scale: 0.2, extra_loss: 0, extra_rtt_ms: 0 } },
  { label: "Loss +10%", imp: { duration_s: 15, bandwidth_scale: 1, extra_loss: 0.1, extra_rtt_ms: 0 } },
  { label: "RTT +300 ms", imp: { duration_s: 15, bandwidth_scale: 1, extra_loss: 0, extra_rtt_ms: 300 } },
];

export default function LiveSimulation() {
  const [activeTab, setActiveTab] = useState<"video-lab" | "replay">("video-lab");

  // State for Deterministic Replay Tab
  const { config, setConfig, result, run, running, error } = useLab();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const tRef = useRef(0);

  const end = result ? result.timeline[result.timeline.length - 1].t : 0;
  useEffect(() => {
    if (!playing || !result) return;
    const id = window.setInterval(() => {
      tRef.current = Math.min(end, tRef.current + 0.1 * speed);
      setT(tRef.current);
      if (tRef.current >= end) setPlaying(false);
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, speed, end, result]);

  const point = useMemo(() => {
    if (!result) return null;
    const idx = Math.min(result.timeline.length - 1, Math.round(t / 0.5));
    return result.timeline[idx];
  }, [result, t]);

  const seek = (v: number) => {
    tRef.current = v;
    setT(v);
  };

  const inject = async (imp: Omit<Impairment, "start_s">) => {
    if (!config) return;
    const next: SimConfig = {
      ...config,
      network: { ...config.network, impairments: [...config.network.impairments, { ...imp, start_s: Math.round(t) }] },
    };
    setConfig(next);
    setPlaying(false);
    await run(next);
  };

  const clearInjections = async () => {
    if (!config) return;
    const next: SimConfig = { ...config, network: { ...config.network, impairments: [] } };
    setConfig(next);
    await run(next);
  };

  const seg = result && point ? Math.min(result.segments.length - 1, Math.floor(point.played_s / result.config.video.segment_s)) : 0;
  const maxBuf = result?.config.video.max_buffer_s ?? 30;
  const dlSeg = result && point ? result.segments.find((s) => s.t_request <= t && t < s.t_complete) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Interactive Lab"
          title="Live Simulation & Video Streaming"
          subtitle="Real-time video streaming simulation with dynamic network controls, WiFi switching, ABR adaptation, and playback buffer mechanics."
        />

        {/* Tab Switcher */}
        <div className="flex rounded-lg border border-border bg-surface-alt p-1 shrink-0">
          <button
            onClick={() => setActiveTab("video-lab")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "video-lab"
                ? "bg-surface text-primary shadow-xs ring-1 ring-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            <Tv className="h-4 w-4" />
            <span>Interactive Video Lab</span>
          </button>
          <button
            onClick={() => setActiveTab("replay")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "replay"
                ? "bg-surface text-primary shadow-xs ring-1 ring-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            <History className="h-4 w-4" />
            <span>Deterministic Replay</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Real-Time Interactive Video Lab */}
      {activeTab === "video-lab" && <InteractiveVideoLab />}

      {/* TAB 2: Deterministic Experiment Replay */}
      {activeTab === "replay" && (
        <BackendGate>
          <div className="space-y-6">
            <ErrorNote message={error} />
            {!result && (
              <Card>
                <p className="mb-3 text-sm text-text-muted">
                  No pre-computed experiment to replay. Run a simulation from the current configuration (or edit in the{" "}
                  <Link to="/experiment-lab" className="text-accent underline">
                    Experiment Lab
                  </Link>
                  ).
                </p>
                <Button onClick={() => void run()} disabled={running}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run now
                </Button>
              </Card>
            )}

            {result && point && (
              <>
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => {
                        if (t >= end) seek(0);
                        setPlaying((p) => !p);
                      }}
                    >
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {playing ? "Pause" : "Play"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setPlaying(false);
                        seek(0);
                      }}
                    >
                      <RotateCcw className="h-4 w-4" /> Restart
                    </Button>
                    <label className="flex items-center gap-2 text-xs text-text-muted">
                      Speed
                      <select
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
                      >
                        {SPEEDS.map((s) => (
                          <option key={s} value={s}>
                            {s}×
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="ml-auto font-mono text-sm tabular-nums">
                      t = {t.toFixed(1)}s / {end.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={end}
                    step={0.1}
                    value={t}
                    className="mt-4 w-full accent-[var(--color-primary)]"
                    onChange={(e) => seek(Number(e.target.value))}
                    aria-label="Timeline position"
                  />
                </Card>

                <section className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">Player state</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                        STATE_STYLE[point.state]
                      }`}
                    >
                      {point.state}
                    </span>
                    <p className="mt-3 text-xs text-text-muted">
                      Playing segment {seg} at{" "}
                      <strong className="text-text">{fmt(point.playing_bitrate_mbps)} Mbps</strong>
                    </p>
                    <p className="mt-1 text-xs text-text-muted">Played {fmt(point.played_s, 1)}s</p>
                  </Card>
                  <Card>
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">Buffer</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{fmt(point.buffer_s, 1)} s</p>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className={`h-full ${point.state === "stalled" ? "bg-error" : "bg-success"}`}
                        style={{ width: `${Math.min(100, (point.buffer_s / maxBuf) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-text-muted">max {maxBuf}s</p>
                  </Card>
                  <Card>
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">Network now</p>
                    <p className="mt-1 text-sm">
                      <strong className="tabular-nums">{fmt(point.bandwidth_mbps)}</strong> Mbps ·{" "}
                      <strong className="tabular-nums">{fmt(point.rtt_ms, 0)}</strong> ms ·{" "}
                      <strong className="tabular-nums">{fmt(point.loss_percent)}</strong>% loss
                    </p>
                    <p className="mt-2 text-[11px] text-text-muted">
                      {result.config.network.impairments.length} fault window(s) configured
                    </p>
                  </Card>
                  <Card>
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">Download</p>
                    {dlSeg ? (
                      <>
                        <p className="mt-1 text-sm">
                          Segment <strong>{result.segments.indexOf(dlSeg)}</strong> at{" "}
                          <strong>{dlSeg.label}</strong>
                        </p>
                        <p className="mt-1 text-[11px] text-text-muted">
                          {fmt(dlSeg.size_megabits, 1)} Mb · {dlSeg.retransmissions} retransmissions · rule {dlSeg.rule}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-text-muted">Idle (buffer full or finished)</p>
                    )}
                  </Card>
                </section>

                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Zap className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium">Inject a 15 s fault at t = {Math.round(t)}s</span>
                    {INJECTIONS.map((i) => (
                      <Button
                        key={i.label}
                        variant="secondary"
                        disabled={running}
                        onClick={() => void inject(i.imp)}
                      >
                        {i.label}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      disabled={running || result.config.network.impairments.length === 0}
                      onClick={() => void clearInjections()}
                    >
                      Clear faults
                    </Button>
                    {running && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  <p className="mt-2 text-[11px] text-text-muted">
                    Faults are written into the shared configuration (visible in the Experiment Lab) and the session
                    is re-simulated with the same seed.
                  </p>
                </Card>

                <Card>
                  <SessionCharts result={result} cursor={t} height={200} />
                </Card>
                <Card>
                  <h2 className="mb-2 text-sm font-semibold">Events up to t = {t.toFixed(1)}s</h2>
                  <EventLog events={result.events} upTo={t} />
                </Card>
              </>
            )}
            <Callout variant="simulation" title="Replay of simulator output">
              The animation moves a cursor over a pre-computed, deterministic simulation.
            </Callout>
          </div>
        </BackendGate>
      )}
    </div>
  );
}
