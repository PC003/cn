import { PlannedPage } from "../components/PlannedPage";
import { NAV_ITEMS } from "../types/nav";

const item = NAV_ITEMS.find((n) => n.path === "/experiment-lab")!;

export default function ExperimentLab() {
  return (
    <PlannedPage
      item={item}
      whatItWillDo={[
        "Network configuration panel: bandwidth, latency, packet loss, jitter",
        "Bandwidth trace editor with presets and a random seed for reproducibility",
        "Network presets (Excellent Wi-Fi, Mobile 4G/5G, Congested, Lossy, High Latency, Sudden Drop)",
        "Video model config: segment duration and bitrate ladder",
        "Run Experiment button driving Network → Transport → Segments → Buffer → ABR → Metrics",
        "Live progress: current bandwidth, bitrate, buffer, segment, packet state, events",
      ]}
      dependsOn={[
        "Network simulator (backend/app/simulation/network.py)",
        "TCP-like and UDP-like transport models",
        "Buffer and ABR models",
        "Experiment controller wiring it all together",
      ]}
    />
  );
}
