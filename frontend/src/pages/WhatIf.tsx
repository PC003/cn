import { PlannedPage } from "../components/PlannedPage";
import { NAV_ITEMS } from "../types/nav";

const item = NAV_ITEMS.find((n) => n.path === "/what-if")!;

export default function WhatIf() {
  return (
    <PlannedPage
      item={item}
      whatItWillDo={[
        "Sweep one parameter (packet loss, latency, bandwidth, or buffer size) across a preset range",
        "Automated sensitivity-analysis runner executing the same experiment once per value, same seed",
        "Parameter-vs-outcome graphs: throughput, rebuffering, average bitrate, retransmissions, QoE",
      ]}
      dependsOn={[
        "Working experiment controller callable in a loop",
        "Deterministic seeding so sweeps are reproducible",
      ]}
    />
  );
}
