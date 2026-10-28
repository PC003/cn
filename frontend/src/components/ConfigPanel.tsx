import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "./Card";
import { Button, NumberField, SelectField, TextField } from "./Field";
import { useLab } from "../state/LabContext";
import { parseNumberList } from "../utils/format";
import type { Impairment, SimConfig } from "../types/sim";

type Section = "network" | "transport" | "video" | "abr" | "qoe";

function patch<K extends keyof SimConfig>(cfg: SimConfig, key: K, value: Partial<SimConfig[K]>): SimConfig {
  return { ...cfg, [key]: { ...(cfg[key] as object), ...(value as object) } } as SimConfig;
}

/** Full configuration editor for one simulation. All values map 1:1 to backend fields. */
export function ConfigPanel({ show = ["network", "transport", "video", "abr", "qoe"] as Section[] }) {
  const { config, setConfig, defaults, resetConfig } = useLab();
  const [stepsText, setStepsText] = useState("");
  const [ladderText, setLadderText] = useState<string | null>(null);
  if (!config || !defaults) return null;
  const n = config.network;
  const t = config.transport;
  const v = config.video;
  const a = config.abr;
  const q = config.qoe;
  const set = (c: SimConfig) => setConfig(c);

  const applyPreset = (name: string) => {
    const p = defaults.presets[name];
    if (p) set({ ...config, network: { ...p } });
  };

  const setImpairment = (i: number, patchImp: Partial<Impairment>) => {
    const next = n.impairments.map((imp, k) => (k === i ? { ...imp, ...patchImp } : imp));
    set(patch(config, "network", { impairments: next }));
  };

  return (
    <div className="space-y-4">
      {show.includes("network") && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Network conditions</h3>
          <div className="mb-3">
            <SelectField
              label="Preset"
              value=""
              onChange={(name) => name && applyPreset(name)}
              options={[
                { value: "", label: "— choose to overwrite network settings —" },
                ...Object.keys(defaults.presets).map((k) => ({ value: k, label: k.replace(/_/g, " ") })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Mean bandwidth" unit="Mbps" step={0.5} min={0.1} value={n.bandwidth_mbps}
              onChange={(x) => set(patch(config, "network", { bandwidth_mbps: x }))} />
            <NumberField label="RTT" unit="ms" step={5} min={1} value={n.rtt_ms}
              onChange={(x) => set(patch(config, "network", { rtt_ms: x }))} />
            <NumberField label="Jitter (std dev)" unit="ms" step={1} min={0} value={n.jitter_ms}
              onChange={(x) => set(patch(config, "network", { jitter_ms: x }))} />
            <NumberField label="Packet loss" unit="%" step={0.1} min={0} max={50}
              value={Number((n.loss_probability * 100).toFixed(4))}
              onChange={(x) => set(patch(config, "network", { loss_probability: x / 100 }))} />
            <SelectField label="Bandwidth profile" value={n.profile}
              onChange={(x) => set(patch(config, "network", { profile: x }))}
              options={[
                { value: "constant", label: "Constant" },
                { value: "random_walk", label: "Random walk (seeded)" },
                { value: "steps", label: "Time-stepped trace" },
              ]} />
            <NumberField label="Variability" hint="log-step std dev (random walk)" step={0.05} min={0}
              value={n.variability} onChange={(x) => set(patch(config, "network", { variability: x }))} />
            <NumberField label="Bottleneck queue" unit="packets" step={10} min={1} value={n.queue_packets}
              onChange={(x) => set(patch(config, "network", { queue_packets: x }))} />
            <NumberField label="Trace interval" unit="s" step={0.5} min={0.5} value={n.trace_interval_s}
              onChange={(x) => set(patch(config, "network", { trace_interval_s: x }))} />
          </div>
          {n.profile === "steps" && (
            <div className="mt-3">
              <TextField
                label="Trace points  (time_s:Mbps, …)"
                hint="e.g. 0:8, 40:1.5, 80:8"
                value={stepsText || n.steps.map(([ts, r]) => `${ts}:${r}`).join(", ")}
                onChange={(txt) => {
                  setStepsText(txt);
                  const pts = txt
                    .split(",")
                    .map((p) => p.split(":").map(Number))
                    .filter((p) => p.length === 2 && p.every(Number.isFinite)) as [number, number][];
                  if (pts.length) set(patch(config, "network", { steps: pts }));
                }}
              />
            </div>
          )}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-text-muted">Failure injection (time windows)</p>
              <Button variant="secondary"
                onClick={() => set(patch(config, "network", {
                  impairments: [...n.impairments,
                    { start_s: 30, duration_s: 15, bandwidth_scale: 0.2, extra_loss: 0, extra_rtt_ms: 0 }],
                }))}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {n.impairments.length === 0 && (
              <p className="text-[11px] text-text-muted">None. Add a window to scale bandwidth or add loss/RTT.</p>
            )}
            {n.impairments.map((imp, i) => (
              <div key={i} className="mb-2 grid grid-cols-5 items-end gap-2 rounded-md bg-surface-alt p-2">
                <NumberField label="start s" value={imp.start_s} min={0}
                  onChange={(x) => setImpairment(i, { start_s: x })} />
                <NumberField label="len s" value={imp.duration_s} min={1}
                  onChange={(x) => setImpairment(i, { duration_s: x })} />
                <NumberField label="bw ×" step={0.1} min={0.01} value={imp.bandwidth_scale}
                  onChange={(x) => setImpairment(i, { bandwidth_scale: x })} />
                <NumberField label="+loss %" step={1} min={0}
                  value={Number((imp.extra_loss * 100).toFixed(3))}
                  onChange={(x) => setImpairment(i, { extra_loss: x / 100 })} />
                <div className="flex items-end gap-1">
                  <NumberField label="+RTT ms" step={10} min={0} value={imp.extra_rtt_ms}
                    onChange={(x) => setImpairment(i, { extra_rtt_ms: x })} />
                  <button aria-label="Remove" className="mb-1 rounded p-1 text-text-muted hover:text-error"
                    onClick={() => set(patch(config, "network", {
                      impairments: n.impairments.filter((_, k) => k !== i),
                    }))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {show.includes("transport") && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Transport model</h3>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Protocol" value={t.protocol}
              onChange={(x) => set(patch(config, "transport", { protocol: x }))}
              options={[
                { value: "tcp", label: "TCP-like" },
                { value: "udp", label: "UDP-like" },
                { value: "quic", label: "QUIC-like" },
              ]} />
            <NumberField label="MSS" unit="bytes" step={20} min={200} value={t.mss_bytes}
              onChange={(x) => set(patch(config, "transport", { mss_bytes: x }))} />
            {t.protocol !== "udp" && (
              <>
                <NumberField label="Initial cwnd" unit="packets" min={1} value={t.init_cwnd_packets}
                  onChange={(x) => set(patch(config, "transport", { init_cwnd_packets: x }))} />
                <NumberField label="Receive window" unit="packets" step={50} min={1} value={t.rwnd_packets}
                  onChange={(x) => set(patch(config, "transport", { rwnd_packets: x }))} />
              </>
            )}
            {t.protocol === "quic" && (
              <NumberField label="Streams per segment" min={1} value={t.quic_streams}
                onChange={(x) => set(patch(config, "transport", { quic_streams: x }))} />
            )}
            {t.protocol === "udp" && (
              <>
                <SelectField label="Application recovery" value={t.udp_recovery}
                  onChange={(x) => set(patch(config, "transport", { udp_recovery: x }))}
                  options={[
                    { value: "none", label: "None (accept gaps)" },
                    { value: "arq", label: "ARQ (NACK + resend)" },
                    { value: "fec", label: "FEC (parity packets)" },
                  ]} />
                <NumberField label="Pacing factor" unit="× bitrate" step={0.5} min={0.5}
                  value={t.udp_pacing_factor}
                  onChange={(x) => set(patch(config, "transport", { udp_pacing_factor: x }))} />
                <SelectField label="Incomplete segment" value={t.udp_on_incomplete}
                  onChange={(x) => set(patch(config, "transport", { udp_on_incomplete: x }))}
                  options={[
                    { value: "accept", label: "Play with gaps" },
                    { value: "drop", label: "Discard segment" },
                  ]} />
                <NumberField label="Concealment penalty" step={0.5} min={0}
                  value={t.udp_concealment_penalty}
                  onChange={(x) => set(patch(config, "transport", { udp_concealment_penalty: x }))} />
                <NumberField label="Max repair rounds" min={0} value={t.udp_max_repair_rounds}
                  onChange={(x) => set(patch(config, "transport", { udp_max_repair_rounds: x }))} />
                <NumberField label="FEC overhead" step={0.05} min={0.05} max={1} value={t.udp_fec_overhead}
                  onChange={(x) => set(patch(config, "transport", { udp_fec_overhead: x }))} />
              </>
            )}
          </div>
        </Card>
      )}

      {show.includes("video") && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Video &amp; playback</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Video length" unit="s" step={10} min={4} value={v.duration_s}
              onChange={(x) => set(patch(config, "video", { duration_s: x }))} />
            <NumberField label="Segment duration" unit="s" step={1} min={0.5} value={v.segment_s}
              onChange={(x) => set(patch(config, "video", { segment_s: x }))} />
            <NumberField label="Startup buffer" unit="s" min={0.5} value={v.startup_buffer_s}
              onChange={(x) => set(patch(config, "video", { startup_buffer_s: x }))} />
            <NumberField label="Rebuffer resume" unit="s" min={0.5} value={v.rebuffer_resume_s}
              onChange={(x) => set(patch(config, "video", { rebuffer_resume_s: x }))} />
            <NumberField label="Max buffer" unit="s" step={5} min={1} value={v.max_buffer_s}
              onChange={(x) => set(patch(config, "video", { max_buffer_s: x }))} />
            <TextField label="Bitrate ladder (Mbps)"
              hint={`${defaults.ladder_labels.join(" / ")} by default`}
              value={ladderText ?? v.ladder_mbps.join(", ")}
              onChange={(txt) => {
                setLadderText(txt);
                const arr = parseNumberList(txt);
                if (arr.length) set(patch(config, "video", { ladder_mbps: arr }));
              }} />
          </div>
        </Card>
      )}

      {show.includes("abr") && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Adaptive bitrate</h3>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Strategy" value={a.strategy}
              onChange={(x) => set(patch(config, "abr", { strategy: x }))}
              options={[
                { value: "throughput", label: "Throughput-based" },
                { value: "buffer", label: "Buffer-based" },
              ]} />
            <NumberField label="Initial level" min={0} value={a.initial_level}
              onChange={(x) => set(patch(config, "abr", { initial_level: x }))} />
            {a.strategy === "throughput" ? (
              <>
                <NumberField label="Safety factor" step={0.05} min={0.1} max={1.5} value={a.safety_factor}
                  onChange={(x) => set(patch(config, "abr", { safety_factor: x }))} />
                <NumberField label="Estimator window" unit="segments" min={1} value={a.estimator_window}
                  onChange={(x) => set(patch(config, "abr", { estimator_window: x }))} />
              </>
            ) : (
              <>
                <NumberField label="Reservoir" unit="s" step={1} min={0} value={a.reservoir_s}
                  onChange={(x) => set(patch(config, "abr", { reservoir_s: x }))} />
                <NumberField label="Cushion" unit="s" step={1} min={1} value={a.cushion_s}
                  onChange={(x) => set(patch(config, "abr", { cushion_s: x }))} />
              </>
            )}
          </div>
        </Card>
      )}

      {show.includes("qoe") && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">QoE penalty weights</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Rebuffer ratio" unit="pts per 1%" step={0.5} min={0}
              value={q.rebuffer_ratio_penalty_per_pct}
              onChange={(x) => set(patch(config, "qoe", { rebuffer_ratio_penalty_per_pct: x }))} />
            <NumberField label="Per stall event" unit="pts" step={0.5} min={0}
              value={q.rebuffer_event_penalty}
              onChange={(x) => set(patch(config, "qoe", { rebuffer_event_penalty: x }))} />
            <NumberField label="Startup delay" unit="pts per s" step={0.5} min={0}
              value={q.startup_penalty_per_s}
              onChange={(x) => set(patch(config, "qoe", { startup_penalty_per_s: x }))} />
            <NumberField label="Switching weight" step={0.1} min={0} value={q.switch_penalty_weight}
              onChange={(x) => set(patch(config, "qoe", { switch_penalty_weight: x }))} />
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <NumberField label="Packet trace (first N packets of seg 0)" min={0} max={5000}
          value={config.packet_trace_limit}
          onChange={(x) => set({ ...config, packet_trace_limit: Math.max(0, Math.round(x)) })} />
        <NumberField label="Random seed" value={config.seed} min={0}
          onChange={(x) => set({ ...config, seed: Math.max(0, Math.round(x)) })} />
        <div className="pt-4">
          <Button variant="ghost" onClick={resetConfig}>Reset to defaults</Button>
        </div>
      </div>
    </div>
  );
}
