export type PageStatus = "ready" | "planned";

export interface NavItem {
  path: string;
  label: string;
  status: PageStatus;
  /** Which project review this page was delivered in. */
  reviewMilestone: 1 | 2 | 3;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Home",
    status: "ready",
    reviewMilestone: 1,
    description: "Project overview and engineering problem statement.",
  },
  {
    path: "/experiment-lab",
    label: "Experiment Lab",
    status: "ready",
    reviewMilestone: 3,
    description: "Configure network conditions, run a streaming session or repeated trials.",
  },
  {
    path: "/tcp-vs-udp",
    label: "TCP vs UDP",
    status: "ready",
    reviewMilestone: 3,
    description: "Controlled side-by-side comparison under identical conditions.",
  },
  {
    path: "/abr-lab",
    label: "ABR Lab",
    status: "ready",
    reviewMilestone: 3,
    description: "Throughput-based and buffer-based ABR, with every decision logged.",
  },
  {
    path: "/live-simulation",
    label: "Live Simulation",
    status: "ready",
    reviewMilestone: 3,
    description: "Real-time video player with dynamic network sliders, Wi-Fi switching, and ABR buffer mechanics.",
  },
  {
    path: "/validation",
    label: "Model Validation",
    status: "ready",
    reviewMilestone: 3,
    description: "Mathis comparison, loss × RTT sweep and repeated trials with confidence intervals.",
  },
  {
    path: "/results",
    label: "Results",
    status: "ready",
    reviewMilestone: 2,
    description: "Metrics, QoE breakdown, and graphs for a completed experiment.",
  },
  {
    path: "/what-if",
    label: "What-If Analysis",
    status: "ready",
    reviewMilestone: 3,
    description: "Sweep one parameter and observe its effect on outcomes.",
  },
  {
    path: "/experiment-history",
    label: "Experiment History",
    status: "ready",
    reviewMilestone: 2,
    description: "Stored experiments with view, duplicate and compare actions.",
  },
];
