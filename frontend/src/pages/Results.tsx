import { PlannedPage } from "../components/PlannedPage";
import { NAV_ITEMS } from "../types/nav";

const item = NAV_ITEMS.find((n) => n.path === "/results")!;

export default function Results() {
  return (
    <PlannedPage
      item={item}
      whatItWillDo={[
        "Metric cards: throughput, bitrate, rebuffering, stalls, loss, retransmissions, buffer, switches, startup delay, QoE",
        "QoE breakdown: quality contribution, rebuffer penalty, switching penalty, startup penalty",
        "Buffer-over-time chart with stall regions marked",
        "Bitrate-over-time chart with ABR decision markers",
        "CSV / JSON export and a generated experiment report",
      ]}
      dependsOn={[
        "Completed experiment result object from the experiment controller",
        "QoE analyzer (backend/app/simulation/qoe.py)",
        "SQLite persistence for experiment results",
      ]}
    />
  );
}
