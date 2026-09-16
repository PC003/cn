import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import type { PageStatus } from "../types/nav";

interface Mapping {
  reportSection: string;
  feature: string;
  route?: string;
  status: PageStatus;
}

const MAPPINGS: Mapping[] = [
  { reportSection: "TCP vs UDP", feature: "TCP vs UDP transport lab", route: "/tcp-vs-udp", status: "planned" },
  { reportSection: "Open Connect architecture", feature: "Architecture visualization", route: "/architecture", status: "ready" },
  { reportSection: "Bulk video delivery over TCP / TLS", feature: "Connection setup animation (SYN/SYN-ACK/ACK, TLS handshake)", route: "/experiment-lab", status: "planned" },
  { reportSection: "TCP optimization (RACK, PRR, BBR)", feature: "Transport explanation + simplified recovery model", route: "/tcp-vs-udp", status: "planned" },
  { reportSection: "Where UDP fits", feature: "UDP-like transport + application-recovery experiment", route: "/tcp-vs-udp", status: "planned" },
  { reportSection: "Adaptive bitrate streaming", feature: "ABR Lab (throughput-based, buffer-based, hybrid)", route: "/abr-lab", status: "planned" },
  { reportSection: "End-to-end request flow", feature: "Playback flow visualization", route: "/experiment-lab", status: "planned" },
  { reportSection: "Live streaming", feature: "Live Simulation mode with fault injection", route: "/live-simulation", status: "planned" },
  { reportSection: "Scale and performance", feature: "Scale visualization (throughput growth, serving stack)", route: "/architecture", status: "planned" },
  { reportSection: "Discussion and conclusion", feature: "What-If Analysis + Results interpretation", route: "/what-if", status: "planned" },
];

export default function ReportMapping() {
  return (
    <div>
      <PageHeader
        eyebrow="Traceability"
        title="Report → Project mapping"
        subtitle="Every major section of the report corresponds to a concrete, demonstrable feature in this application."
      />

      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <th className="py-2 pr-4">Report section</th>
              <th className="py-2 pr-4">Project feature</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {MAPPINGS.map((m) => (
              <tr key={m.reportSection} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 font-medium">{m.reportSection}</td>
                <td className="py-3 pr-4 text-text-muted">
                  {m.route ? (
                    <Link to={m.route} className="text-accent underline">
                      {m.feature}
                    </Link>
                  ) : (
                    m.feature
                  )}
                </td>
                <td className="py-3">
                  <StatusPill status={m.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-text-muted">
        &ldquo;Planned&rdquo; features are scoped in the codebase (folder structure, stub modules) but
        their logic is being implemented across Reviews 2 and 3, per the phased development plan in
        the README.
      </p>
    </div>
  );
}
