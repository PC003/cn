import { PlannedPage } from "../components/PlannedPage";
import { NAV_ITEMS } from "../types/nav";

const item = NAV_ITEMS.find((n) => n.path === "/tcp-vs-udp")!;

export default function TcpVsUdp() {
  return (
    <PlannedPage
      item={item}
      whatItWillDo={[
        "Controlled experiment: identical bandwidth trace, latency, loss, jitter, video and seed for both runs",
        "Animated packet flow: SYN/SYN-ACK/ACK/DATA for TCP-like, plain DATA/LOST for UDP-like",
        "Head-of-line blocking demonstration (packet 3 lost → 4, 5 withheld → retransmission → delivery)",
        "UDP + optional application-level recovery experiment",
        "Side-by-side metrics table: throughput, bitrate, rebuffering, loss, retransmissions, buffer, QoE",
        "Synchronized graphs for both runs",
      ]}
      dependsOn={[
        "TCP-like transport model (tcp_model.py, congestion.py)",
        "UDP-like transport model (udp_model.py)",
        "Shared network simulator so both runs see identical conditions",
      ]}
    />
  );
}
