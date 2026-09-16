import { PlannedPage } from "../components/PlannedPage";
import { NAV_ITEMS } from "../types/nav";

const item = NAV_ITEMS.find((n) => n.path === "/experiment-history")!;

export default function ExperimentHistory() {
  return (
    <PlannedPage
      item={item}
      whatItWillDo={[
        "List of stored experiments with timestamp, config summary and headline metrics",
        "View, duplicate, compare and delete actions",
        "Two-experiment comparison view reporting factual measured differences (no declared 'winner')",
      ]}
      dependsOn={[
        "SQLite experiment table (backend/app/database)",
        "Experiment result persistence from the controller",
      ]}
    />
  );
}
