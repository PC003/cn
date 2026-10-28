import type { SegmentRow } from "../types/sim";
import { fmt } from "../utils/format";

export function SegmentTable({ segments, maxHeight = "28rem" }: { segments: SegmentRow[]; maxHeight?: string }) {
  return (
    <div className="overflow-auto rounded-lg border border-border" style={{ maxHeight }}>
      <table className="w-full min-w-[56rem] text-left text-xs">
        <thead className="sticky top-0 bg-surface-alt text-text-muted">
          <tr>
            {["#", "Quality", "Rule", "Est. Mbps", "Buffer s", "Size Mb", "Download s", "Goodput Mbps",
              "Lost", "Retx", "RTO", "HOL pkt·s", "Delivered", "Reason"].map((h) => (
              <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {segments.map((s, i) => (
            <tr key={i} className="border-t border-border align-top">
              <td className="px-2 py-1.5 tabular-nums">{i}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{s.label} <span className="text-text-muted">({s.bitrate_mbps})</span></td>
              <td className="px-2 py-1.5 font-mono text-[11px]">{s.rule}</td>
              <td className="px-2 py-1.5 tabular-nums">{fmt(s.estimate_mbps)}</td>
              <td className="px-2 py-1.5 tabular-nums">{fmt(s.buffer_s, 1)}</td>
              <td className="px-2 py-1.5 tabular-nums">{fmt(s.size_megabits, 1)}</td>
              <td className="px-2 py-1.5 tabular-nums">{fmt(s.download_s)}</td>
              <td className="px-2 py-1.5 tabular-nums">{fmt(s.throughput_mbps)}</td>
              <td className="px-2 py-1.5 tabular-nums">{s.packets_lost}</td>
              <td className="px-2 py-1.5 tabular-nums">{s.retransmissions}</td>
              <td className="px-2 py-1.5 tabular-nums">{s.timeouts}</td>
              <td className="px-2 py-1.5 tabular-nums">{fmt(s.hol_blocked_packet_s, 2)}</td>
              <td className="px-2 py-1.5 tabular-nums">{fmt(s.delivered_fraction * 100, 1)}%</td>
              <td className="min-w-[16rem] px-2 py-1.5 text-text-muted">{s.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
