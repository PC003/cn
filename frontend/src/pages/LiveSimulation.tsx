import { PlannedPage } from "../components/PlannedPage";
import { NAV_ITEMS } from "../types/nav";

const item = NAV_ITEMS.find((n) => n.path === "/live-simulation")!;

export default function LiveSimulation() {
  return (
    <PlannedPage
      item={item}
      whatItWillDo={[
        "Animated, step-by-step playback of an experiment over a WebSocket connection",
        "Controls: start, pause, resume, restart, 1x/2x/4x speed",
        "Failure injection: bandwidth drop, packet loss spike, latency spike, restore-to-normal",
        "Demo Mode: one click loads the scripted 60s scenario used for the project presentation",
      ]}
      dependsOn={[
        "Experiment engine running in a steppable, time-boxed loop",
        "WebSocket endpoint streaming simulation state",
        "Failure-injection hooks in the network simulator",
      ]}
    />
  );
}
