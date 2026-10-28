import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SessionResult } from "../types/sim";

const AXIS = { fontSize: 11, fill: "var(--color-text-muted)" };
const GRID = "var(--color-border)";

const SERIES_COLORS = {
  tcp: "#e5222b",
  udp: "#0f6fde",
  quic: "#147a3f",
  bandwidth: "#0f6fde",
  bitrate: "#e5222b",
  buffer: "#147a3f",
  rtt: "#a05a00",
  loss: "#8250df",
};

/** Network bandwidth vs selected bitrate, and playback buffer, from one simulation run. */
export function SessionCharts({
  result,
  cursor,
  height = 220,
}: {
  result: SessionResult;
  cursor?: number;
  height?: number;
}) {
  const data = result.timeline;
  const maxBuf = result.config.video.max_buffer_s;
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-medium text-text-muted">
          Available bandwidth vs. playing bitrate (Mbps)
        </p>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 5, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} tick={AXIS} unit="s" />
            <YAxis tick={AXIS} width={40} />
            <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
              labelFormatter={(l) => `t = ${l}s`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="bandwidth_mbps" name="Bandwidth" stroke={SERIES_COLORS.bandwidth}
              dot={false} strokeWidth={2} type="stepAfter" isAnimationActive={false} />
            <Line dataKey="playing_bitrate_mbps" name="Playing bitrate" stroke={SERIES_COLORS.bitrate}
              dot={false} strokeWidth={2} type="stepAfter" isAnimationActive={false} />
            {cursor !== undefined && <ReferenceLine x={cursor} stroke="var(--color-text)" strokeDasharray="4 2" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-text-muted">
          Playback buffer (s) — shaded regions are rebuffering
        </p>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 5, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} tick={AXIS} unit="s" />
            <YAxis tick={AXIS} width={40} domain={[0, Math.ceil(maxBuf)]} />
            <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
              labelFormatter={(l) => `t = ${l}s`} />
            {result.stalls.map((s, i) => (
              <ReferenceArea key={i} x1={s.start} x2={s.end} fill="#e5222b" fillOpacity={0.18} />
            ))}
            <Line dataKey="buffer_s" name="Buffer" stroke={SERIES_COLORS.buffer} dot={false}
              strokeWidth={2} isAnimationActive={false} />
            {cursor !== undefined && <ReferenceLine x={cursor} stroke="var(--color-text)" strokeDasharray="4 2" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-text-muted">Path RTT (ms) and loss (%)</p>
        <ResponsiveContainer width="100%" height={Math.round(height * 0.7)}>
          <ComposedChart data={data} margin={{ top: 5, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} tick={AXIS} unit="s" />
            <YAxis yAxisId="l" tick={AXIS} width={40} />
            <YAxis yAxisId="r" orientation="right" tick={AXIS} width={40} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="l" dataKey="rtt_ms" name="RTT (ms)" stroke={SERIES_COLORS.rtt} dot={false}
              type="stepAfter" isAnimationActive={false} />
            <Line yAxisId="r" dataKey="loss_percent" name="Loss (%)" stroke={SERIES_COLORS.loss}
              dot={false} type="stepAfter" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
