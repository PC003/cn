import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";

const STEPS = [
  { title: "Start Wireshark", detail: "Launch Wireshark with permission to capture on your active network interface." },
  { title: "Select network interface", detail: "Choose the interface used by your machine (e.g. Wi-Fi or loopback for local tests)." },
  { title: "Start capture", detail: "Begin capturing before starting the local experiment so the handshake is recorded from the first packet." },
  { title: "Run the local TCP experiment", detail: "Trigger this project's optional local TCP socket test (see 'Local Socket Experiment', Review 3)." },
  { title: "Run the local UDP experiment", detail: "Trigger the corresponding local UDP socket test under the same conditions." },
  { title: "Inspect packets", detail: "Filter by the port used by the test server, e.g. tcp.port == 5001 or udp.port == 5002." },
  { title: "Observe the TCP handshake", detail: "Look for the SYN, SYN-ACK, ACK sequence at the start of the TCP capture." },
  { title: "Observe TCP ACKs / retransmissions", detail: "Under induced loss, look for duplicate ACKs and [TCP Retransmission] flagged frames." },
  { title: "Compare with UDP datagrams", detail: "Note the absence of a handshake and of any built-in acknowledgement or retransmission in the UDP capture." },
];

export default function PacketCaptureGuide() {
  return (
    <div>
      <PageHeader
        eyebrow="Independent Verification"
        title="Packet Capture Guide"
        subtitle="How to verify TCP and UDP behaviour yourself, on your own machine, using Wireshark and this project's local socket tests."
      />

      <Callout variant="warning" title="This is a separate, local experiment">
        This guide captures traffic from small local TCP/UDP test sockets that this project runs on
        your own machine (planned for Review 3). It does <span className="font-medium">not</span>{" "}
        capture, decrypt, or inspect real Netflix traffic, which is encrypted end-to-end and out of
        scope for this project.
      </Callout>

      <div className="mt-8 space-y-3">
        {STEPS.map((step, i) => (
          <Card key={step.title} className="flex items-start gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm text-text-muted">{step.detail}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">What to expect in the TCP capture</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-muted">
            <li>Three-way handshake (SYN / SYN-ACK / ACK) before any data</li>
            <li>Monotonically increasing sequence and acknowledgement numbers</li>
            <li>Retransmissions and duplicate ACKs if loss is induced</li>
            <li>A FIN/ACK teardown at the end of the connection</li>
          </ul>
        </Card>
        <Card>
          <h3 className="font-semibold">What to expect in the UDP capture</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-muted">
            <li>No handshake &mdash; the first frame is already a data datagram</li>
            <li>No sequence/acknowledgement numbers at the transport layer</li>
            <li>Lost datagrams simply do not appear again &mdash; no automatic retransmission</li>
            <li>No explicit connection teardown</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
