export type PageStatus = "ready" | "planned";

export interface NavItem {
  path: string;
  label: string;
  status: PageStatus;
  /** Which project review this page is targeted for. */
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
    path: "/architecture",
    label: "Architecture",
    status: "ready",
    reviewMilestone: 1,
    description: "How the simulator will be structured, end to end.",
  },
  {
    path: "/report-mapping",
    label: "Report → Project",
    status: "ready",
    reviewMilestone: 1,
    description: "Maps each report section to a concrete project feature.",
  },
  {
    path: "/packet-capture-guide",
    label: "Packet Capture Guide",
    status: "ready",
    reviewMilestone: 1,
    description: "How to independently verify TCP/UDP behaviour with Wireshark.",
  },
  {
    path: "/viva",
    label: "Viva Mode",
    status: "ready",
    reviewMilestone: 1,
    description: "Anticipated viva questions with grounded answers.",
  },
  {
    path: "/about",
    label: "About / Assumptions",
    status: "ready",
    reviewMilestone: 1,
    description: "Scope, assumptions, and limitations of the simulation.",
  },
  {
    path: "/experiment-lab",
    label: "Experiment Lab",
    status: "planned",
    reviewMilestone: 3,
    description: "Configure network conditions and run a full streaming experiment.",
  },
  {
    path: "/tcp-vs-udp",
    label: "TCP vs UDP",
    status: "planned",
    reviewMilestone: 3,
    description: "Controlled side-by-side comparison under identical conditions.",
  },
  {
    path: "/abr-lab",
    label: "ABR Lab",
    status: "planned",
    reviewMilestone: 3,
    description: "Throughput-based, buffer-based and hybrid ABR algorithms.",
  },
  {
    path: "/live-simulation",
    label: "Live Simulation",
    status: "planned",
    reviewMilestone: 3,
    description: "Animated, real-time playback of an experiment with fault injection.",
  },
  {
    path: "/results",
    label: "Results",
    status: "planned",
    reviewMilestone: 2,
    description: "Metrics, QoE breakdown, and graphs for a completed experiment.",
  },
  {
    path: "/what-if",
    label: "What-If Analysis",
    status: "planned",
    reviewMilestone: 3,
    description: "Sweep one parameter and observe its effect on outcomes.",
  },
  {
    path: "/experiment-history",
    label: "Experiment History",
    status: "planned",
    reviewMilestone: 2,
    description: "Stored experiments with view, duplicate and compare actions.",
  },
];
