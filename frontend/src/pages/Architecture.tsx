import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { ClickableFlow, type FlowNode } from "../components/ClickableFlow";

const APP_NODES: FlowNode[] = [
  {
    id: "user",
    label: "User",
    detail: "Configures a network scenario and video model, then triggers an experiment run.",
  },
  {
    id: "react",
    label: "React UI",
    hint: "TypeScript + Vite + Tailwind",
    detail:
      "Presents configuration forms, live simulation views and charts (Recharts). Talks to the backend exclusively over REST, and over WebSockets for live-mode step-by-step playback.",
  },
  {
    id: "fastapi",
    label: "FastAPI",
    hint: "Python",
    detail:
      "Exposes REST endpoints for running experiments, fetching results and managing history. Validates all input with Pydantic models before any simulation runs.",
  },
  {
    id: "controller",
    label: "Experiment Controller",
    detail:
      "Orchestrates one experiment run: takes a validated configuration, wires up the network, transport, ABR and buffer models with a shared seeded RNG, and drives the simulation loop.",
  },
  {
    id: "network",
    label: "Network Simulator",
    detail:
      "Produces bandwidth, latency, jitter and packet-loss values over time from a trace or preset, using a seeded random source so runs are reproducible.",
  },
  {
    id: "transport",
    label: "Transport Model",
    detail:
      "Simplified TCP-like or UDP-like delivery of packets over the simulated network: handshake, sequencing, loss, retransmission (TCP-like) or unordered/undelivered datagrams (UDP-like).",
  },
  {
    id: "streaming",
    label: "Streaming Model",
    detail:
      "Segments the video according to the configured bitrate ladder and segment duration, and requests each segment through the transport model.",
  },
  {
    id: "abr",
    label: "ABR Controller",
    detail:
      "Chooses which representation to request next, based on estimated throughput and/or buffer occupancy, and records the reason for every switch.",
  },
  {
    id: "buffer",
    label: "Buffer",
    detail:
      "Tracks simulated playback buffer occupancy over time: fills as segments arrive, drains during playback, and triggers rebuffering/stall events when it empties.",
  },
  {
    id: "qoe",
    label: "QoE Analyzer",
    detail:
      "Combines average quality, rebuffering penalty, bitrate-switch penalty and startup penalty into a single simplified 0-100 QoE score, with each component shown separately.",
  },
  {
    id: "db",
    label: "Database / Results",
    hint: "SQLite",
    detail:
      "Persists experiment configuration, timeline and computed metrics so past runs can be viewed, duplicated, compared and exported.",
  },
];

const OCA_NODES: FlowNode[] = [
  {
    id: "control-plane",
    label: "AWS Control Plane",
    detail:
      "Per the report, playback authorization, server steering and cache-health/fill-control decisions happen in the control plane. It decides which server a client should use and coordinates playback, but does not itself carry video bytes.",
  },
  {
    id: "backbone",
    label: "Open Connect Backbone",
    detail:
      "The dedicated network connecting Open Connect Appliances back to Netflix's systems, used for content fill and health/telemetry rather than for serving individual client requests.",
  },
  {
    id: "oca",
    label: "Open Connect Appliance",
    hint: "FreeBSD, NGINX",
    detail:
      "The data-plane cache server described in the report: FreeBSD-based, serving video over NGINX with sendfile/kTLS-style optimizations so video segments can be delivered at high throughput with low CPU overhead.",
  },
  {
    id: "client-oca",
    label: "Client",
    detail:
      "The Netflix client receives instructions from the control plane about which OCA to use, then requests video segments directly from that OCA over HTTPS/TCP.",
  },
];

export default function Architecture() {
  return (
    <div>
      <PageHeader
        eyebrow="Report Section 3 & System Design"
        title="Architecture"
        subtitle="How the application is put together, and how it relates to the publicly documented Netflix Open Connect architecture."
      />

      <Callout variant="simulation" title="Two different diagrams, two different purposes">
        The first diagram below is <span className="font-medium">this project's own software architecture</span>.
        The second is a <span className="font-medium">conceptual illustration</span> of the Open Connect
        architecture as described in the report &mdash; it is not a live network diagram of Netflix's
        actual infrastructure.
      </Callout>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Application architecture</h2>
        <p className="mb-4 text-sm text-text-muted">
          Click a component to see what it does. In Review 1, the React UI and FastAPI layers are
          wired up end to end (see the live backend status on Home); the simulation-specific
          components below them are scaffolded but not yet implemented.
        </p>
        <Card>
          <ClickableFlow nodes={APP_NODES} direction="vertical" />
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Open Connect architecture (conceptual)</h2>
        <p className="mb-4 text-sm text-text-muted">
          The control plane decides and coordinates playback and server selection. The data plane
          delivers the video itself, flowing directly from the OCA to the client.
        </p>
        <Card>
          <ClickableFlow nodes={OCA_NODES} direction="horizontal" />
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Data plane vs control plane</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="font-semibold text-accent">Control plane</h3>
            <p className="mt-2 text-sm text-text-muted">
              Handles playback authorization, steering the client to an appropriate Open Connect
              Appliance, and monitoring cache health &mdash; the &ldquo;which server, and is it
              healthy&rdquo; decisions. It does not carry the video bytes.
            </p>
          </Card>
          <Card>
            <h3 className="font-semibold text-primary">Data plane</h3>
            <p className="mt-2 text-sm text-text-muted">
              The Open Connect Appliance streams video segments directly to the client over
              TCP/TLS. This is the high-throughput path that this project's transport simulation
              focuses on.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
