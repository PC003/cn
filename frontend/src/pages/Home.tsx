import { Link } from "react-router-dom";
import { Play, GitCompare, SlidersHorizontal, BarChart3, ArrowRight } from "lucide-react";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { FlowDiagram } from "../components/FlowDiagram";
import { useBackendStatus } from "../hooks/useBackendStatus";

const ACTIONS = [
  {
    to: "/experiment-lab",
    icon: Play,
    title: "Run Experiment",
    description: "Configure a network and observe the full streaming pipeline react to it.",
  },
  {
    to: "/tcp-vs-udp",
    icon: GitCompare,
    title: "Compare TCP vs UDP",
    description: "Identical conditions, transport-only difference — a controlled experiment.",
  },
  {
    to: "/abr-lab",
    icon: SlidersHorizontal,
    title: "Explore ABR",
    description: "See how throughput-based and buffer-based algorithms pick a bitrate.",
  },
  {
    to: "/results",
    icon: BarChart3,
    title: "View Results",
    description: "Metrics, QoE breakdown and graphs generated from simulation runs.",
  },
];

export default function Home() {
  const { info } = useBackendStatus();

  return (
    <div className="space-y-10">
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Computer Networks Case Study &mdash; Interactive Prototype
        </p>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
          Netflix Streaming Transport Lab
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-muted md:text-lg">
          Explore how transport protocols, network conditions, adaptive bitrate selection and
          buffering interact in large-scale video streaming.
        </p>
        <p className="mt-4 max-w-2xl text-sm text-text-muted">
          Based on the report{" "}
          <span className="font-medium text-text">
            &ldquo;Transport Layer in Practice &mdash; How Netflix Streams Video Using TCP and UDP&rdquo;
          </span>
          . This is an interactive simulation built to demonstrate the report's concepts, not a
          reproduction of Netflix's private production infrastructure.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((action) => (
          <Link key={action.to} to={action.to}>
            <Card className="group h-full transition-colors hover:border-primary/50">
              <action.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{action.title}</h3>
              <p className="mt-1 text-sm text-text-muted">{action.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Open <ArrowRight className="h-3 w-3" />
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">The engineering problem</h2>
        <Card>
          <p className="text-sm leading-relaxed text-text-muted">
            Modern video streaming must deliver enormous amounts of data to geographically
            distributed clients while available bandwidth, latency, packet loss and jitter
            constantly change. <span className="font-medium text-text">TCP</span> provides
            reliable, ordered, congestion-controlled delivery but adds connection setup,
            retransmission delay and head-of-line blocking.{" "}
            <span className="font-medium text-text">UDP</span> provides low-overhead,
            connectionless delivery but no built-in reliability, ordering or congestion control.
            This lab lets you configure a network and experimentally observe how these trade-offs
            propagate through transport &rarr; segment delivery &rarr; buffer &rarr; adaptive
            bitrate decisions &rarr; playback quality.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Conceptual pipeline</h2>
        <Card>
          <FlowDiagram
            direction="horizontal"
            steps={[
              { label: "Network Conditions" },
              { label: "Transport Behaviour" },
              { label: "Segment Delivery" },
              { label: "Buffer" },
              { label: "ABR Decision" },
              { label: "Video Quality" },
              { label: "QoE" },
            ]}
          />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Architecture preview</h2>
        <Card>
          <FlowDiagram
            direction="vertical"
            steps={[
              { label: "Client" },
              { label: "Control Plane", hint: "playback, authorization, steering" },
              { label: "OCA / Streaming Server", hint: "Open Connect Appliance" },
              { label: "TCP / TLS", hint: "reliable transport" },
              { label: "Video Segments" },
              { label: "ABR" },
              { label: "Buffer" },
              { label: "Playback" },
            ]}
          />
          <p className="mt-4 text-xs text-text-muted">
            See the full <Link to="/architecture" className="text-accent underline">Architecture</Link> page
            for the component-by-component breakdown, and{" "}
            <Link to="/report-mapping" className="text-accent underline">Report &rarr; Project</Link> for
            how each report section maps to a concrete feature.
          </p>
        </Card>
      </section>

      <Callout variant="simulation" title="Educational simulation">
        Every visualization in this project is labelled as a simplified model, simulation, or
        educational approximation where it goes beyond what the report documents. See{" "}
        <Link to="/about" className="text-accent underline">About / Assumptions</Link> for the full list
        of limitations.
      </Callout>

      <section className="text-xs text-text-muted">
        {info ? (
          <p>
            Backend reachable &mdash; phase reported: <span className="font-medium text-text">{info.phase}</span>{" "}
            (targeting Review {info.review_milestone}).
          </p>
        ) : (
          <p>Backend not reachable yet &mdash; start it to see live project status here.</p>
        )}
      </section>
    </div>
  );
}
