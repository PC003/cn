import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";

const QA = [
  {
    q: "Why is TCP reliable?",
    a: "TCP numbers every byte it sends, requires the receiver to acknowledge what it has received, and retransmits anything not acknowledged within a timeout. Combined with in-order delivery to the application, this guarantees that data arrives complete and in order, or the connection reports an error.",
  },
  {
    q: "Why is UDP not reliable?",
    a: "UDP sends independent datagrams with no sequence numbers, no acknowledgements and no retransmission logic. If a datagram is lost, corrupted, or arrives out of order, UDP itself does nothing about it — any reliability has to be built by the application on top.",
  },
  {
    q: "What is head-of-line blocking?",
    a: "Because TCP delivers data to the application strictly in order, a single lost segment forces the receiver to hold later, already-arrived segments in its buffer until the missing one is retransmitted and received. The 'head' of the queue blocks everything behind it. This project's TCP-like model visualizes this directly (Packet 3 lost, Packets 4-5 withheld until Packet 3 is retransmitted).",
  },
  {
    q: "What is retransmission?",
    a: "When a sender detects that a packet was lost — via a timeout or duplicate acknowledgements — it re-sends that packet. In this project's simplified TCP-like model, retransmission is triggered on detected loss and adds delay before that segment can be delivered to the buffer.",
  },
  {
    q: "What is congestion control?",
    a: "A sender-side mechanism that limits how much unacknowledged data can be in flight (the congestion window) so the sender does not overwhelm the network path. This project models it in a simplified way — window growth on success, reduction on detected loss — and explicitly does not claim to reproduce a specific real-world algorithm like BBR unless labelled as such.",
  },
  {
    q: "What is flow control?",
    a: "A receiver-side mechanism (TCP's advertised window) that prevents a fast sender from overwhelming a slow receiver's buffer, independent of network congestion. This project focuses on congestion rather than receiver-side flow control, since the receiver (the player) is not the bottleneck being simulated.",
  },
  {
    q: "What is ABR?",
    a: "Adaptive Bitrate streaming: the client requests each video segment at whichever quality (bitrate) representation is appropriate for current conditions, based on signals like estimated throughput and buffer occupancy, rather than at one fixed quality.",
  },
  {
    q: "Why does video streaming need a buffer?",
    a: "Network conditions fluctuate, but playback needs a continuous stream of frames. A buffer of already-downloaded video absorbs temporary drops in delivery speed so the player does not have to pause every time throughput dips.",
  },
  {
    q: "What happens when bandwidth suddenly decreases?",
    a: "Segment downloads take longer relative to their playback duration, so the buffer, which is being drained by playback at a fixed rate, starts shrinking. If the buffer runs out before the next segment finishes downloading, playback stalls (a rebuffering event). This project's ABR controller is meant to react before that happens by lowering the requested bitrate.",
  },
  {
    q: "Why can bitrate switching prevent rebuffering?",
    a: "A lower-bitrate segment is smaller and downloads faster for the same bandwidth, so switching down reduces the download time relative to playback time, letting the buffer stabilize or recover instead of running out.",
  },
  {
    q: "Why does UDP not automatically mean better streaming?",
    a: "UDP removes TCP's overhead (handshake, ordered retransmission, head-of-line blocking) but also removes its guarantees. Without reliability, ordering or congestion control, an application using raw UDP for bulk video would need to reimplement whatever subset of those guarantees it needs — and the report documents that Netflix's bulk video delivery path is HTTP(S) over TCP, not raw UDP.",
  },
  {
    q: "Where can UDP be useful in a streaming ecosystem?",
    a: "For latency-sensitive, loss-tolerant traffic such as real-time control signalling, certain live/low-latency paths, or protocols like QUIC that run over UDP but re-implement reliability and congestion control themselves at the application/transport-library layer, avoiding some of TCP's head-of-line blocking.",
  },
  {
    q: "What is Open Connect?",
    a: "Netflix's own CDN, described in the report as appliances (OCAs) placed at ISPs and IXPs that cache and serve video directly to nearby clients, coordinated by a control plane running in AWS.",
  },
  {
    q: "What is the control plane?",
    a: "The part of the system that makes decisions — playback authorization, which OCA a client should use (steering), and cache health/fill control — without itself carrying video bytes.",
  },
  {
    q: "What is the data plane?",
    a: "The part of the system that actually delivers the video bytes: the Open Connect Appliance streaming segments to the client over TCP/TLS.",
  },
  {
    q: "Why does CDN placement matter?",
    a: "Placing servers physically and topologically close to end users (at ISPs/IXPs) reduces latency and the number of network hops, and avoids saturating long-haul transit links, which matters enormously at the data volumes video streaming requires.",
  },
  {
    q: "What is RACK?",
    a: "Recent ACKnowledgment: a TCP loss-detection mechanism that uses the timing of received ACKs (rather than only duplicate-ACK counting or timeouts) to more quickly and accurately detect lost segments. This project references it as documented in the report but implements only a simplified, timeout/duplicate-ACK-style loss detection, clearly labelled as simplified.",
  },
  {
    q: "What is PRR?",
    a: "Proportional Rate Reduction: a TCP recovery algorithm that reduces the sending rate smoothly and proportionally during loss recovery, instead of an abrupt window collapse, to avoid over-correcting. Referenced conceptually; not reproduced exactly in this project's simplified congestion model.",
  },
  {
    q: "What is BBR?",
    a: "Bottleneck Bandwidth and RTT: a congestion-control algorithm that models the network path's bandwidth and minimum RTT directly, rather than reacting to loss alone, aiming for higher throughput with less queuing delay. The report discusses TCP optimizations like BBR; this project's congestion model is a simplified, generic one and does not claim to implement BBR itself.",
  },
  {
    q: "Why does Netflix optimize the TCP stack?",
    a: "At the scale described in the report (hundreds of gigabits to hundreds of terabits per second in aggregate), even small inefficiencies in the TCP/TLS/kernel path multiply enormously. Optimizations like kernel TLS, sendfile-based zero-copy, and tuned congestion control reduce CPU and improve throughput per server.",
  },
  {
    q: "Why are segment sizes important for live streaming?",
    a: "Smaller segments reduce the end-to-end latency between an event happening and it appearing on screen, since the client does not have to wait for a large chunk to finish encoding and uploading — but smaller segments also add more request/response and ABR-decision overhead per second of video.",
  },
  {
    q: "What assumptions does this project make?",
    a: "That TCP/UDP behaviour, congestion control, ABR and QoE can be usefully approximated with simplified, time-stepped, seeded-random models for teaching purposes; that Netflix's publicly documented architecture (Open Connect, control/data plane split, TCP-based bulk delivery) is accurately represented at a conceptual level; and that no proprietary implementation detail is claimed beyond what the report states. Full list on the About / Assumptions page.",
  },
  {
    q: "Is this an actual Netflix implementation?",
    a: "No. This is an educational simulation built for a Computer Networks case study, inspired by the publicly documented Netflix architecture described in the report. It does not use, access, or reproduce Netflix's proprietary production code, algorithms, or infrastructure.",
  },
];

export default function VivaMode() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div>
      <PageHeader
        eyebrow="Preparation"
        title="Viva Mode"
        subtitle="Anticipated questions with answers grounded in the report and in what this project actually implements."
      />

      <div className="space-y-2">
        {QA.map((item, i) => {
          const open = openIndex === i;
          return (
            <Card key={item.q} className="p-0">
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="font-medium">
                  <span className="mr-2 text-text-muted">{i + 1}.</span>
                  {item.q}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-text-muted">
                  {item.a}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
