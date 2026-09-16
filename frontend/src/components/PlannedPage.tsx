import { Construction } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { Card } from "./Card";
import type { NavItem } from "../types/nav";

/**
 * Placeholder for pages scoped to later reviews. Shown instead of dead links
 * so the full application map is visible now, without faking functionality
 * that the simulation engine does not yet provide.
 */
export function PlannedPage({
  item,
  whatItWillDo,
  dependsOn,
}: {
  item: NavItem;
  whatItWillDo: string[];
  dependsOn: string[];
}) {
  return (
    <div>
      <PageHeader
        eyebrow={`Planned for Review ${item.reviewMilestone}`}
        title={item.label}
        subtitle={item.description}
      />
      <Card className="border-dashed">
        <div className="flex items-start gap-3">
          <Construction className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">Not yet implemented</p>
            <p className="mt-1 text-sm text-text-muted">
              This page is part of the full application plan. It requires the simulation engine
              (network, transport, buffer and ABR models), which is being built for Review{" "}
              {item.reviewMilestone}. For Review 1 the goal is to establish the architecture, the
              conceptual model and the working frontend/backend scaffold that this page will sit on
              top of.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">What this page will do</h2>
          <ul className="space-y-2 text-sm text-text-muted">
            {whatItWillDo.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-primary">&rsaquo;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Depends on</h2>
          <ul className="space-y-2 text-sm text-text-muted">
            {dependsOn.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-accent">&rsaquo;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
