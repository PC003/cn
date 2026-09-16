import { PlannedPage } from "../components/PlannedPage";
import { NAV_ITEMS } from "../types/nav";

const item = NAV_ITEMS.find((n) => n.path === "/abr-lab")!;

export default function AbrLab() {
  return (
    <PlannedPage
      item={item}
      whatItWillDo={[
        "Throughput-based ABR: safety-factor-scaled recent throughput estimate",
        "Buffer-based ABR: configurable reservoir and cushion thresholds",
        "Optional hybrid ABR combining throughput, buffer level and previous bitrate",
        "Per-decision event log: previous bitrate, new bitrate, estimated bandwidth, buffer, algorithm, decision rule",
        "Bitrate-over-time and buffer-over-time charts synced to the event log",
      ]}
      dependsOn={[
        "ABR controller (backend/app/simulation/abr.py)",
        "Buffer model providing occupancy signal",
        "Segment/transport pipeline providing throughput signal",
      ]}
    />
  );
}
