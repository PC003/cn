"""
Optional real-socket experiment (separate from the simulator).

Runs a local TCP transfer and a local UDP transfer over the loopback
interface and records what the operating system actually does:

* TCP: connection-setup time (SYN/SYN-ACK/ACK completes inside connect()),
  time to first byte, transfer time, goodput. Reliability and flow control
  are provided by the kernel, so every byte arrives.
* UDP: no setup; datagrams are sent as fast as possible, so the receiver's
  socket buffer can overflow and the kernel *really* drops datagrams. Nothing
  is retransmitted. Counts of received/reordered datagrams are recorded.

Loopback has no propagation delay and (normally) no random loss, so this is
NOT a measurement of Internet behaviour, and nothing here is produced by the
simulator. To observe handshakes and retransmissions with induced network
loss/delay, capture this run in Wireshark and shape the loopback interface
(see docs/socket-experiment.md).

Usage (from backend/):  python -m experiments.socket_experiment --out ../docs/socket-experiment-results.json
"""

from __future__ import annotations

import argparse
import json
import platform
import socket
import struct
import threading
import time
from datetime import datetime, timezone
from typing import Any

HOST = "127.0.0.1"


def tcp_trial(port: int, nbytes: int) -> dict[str, Any]:
    ready = threading.Event()
    srv_stats: dict[str, Any] = {}

    def server() -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((HOST, port))
            s.listen(1)
            ready.set()
            conn, _ = s.accept()
            with conn:
                chunk = b"x" * 65536
                sent = 0
                while sent < nbytes:
                    n = min(len(chunk), nbytes - sent)
                    conn.sendall(chunk[:n])
                    sent += n
                srv_stats["sent"] = sent

    th = threading.Thread(target=server, daemon=True)
    th.start()
    ready.wait()
    t0 = time.perf_counter()
    c = socket.create_connection((HOST, port))
    t_connect = time.perf_counter() - t0
    got = 0
    t_first = None
    with c:
        while True:
            data = c.recv(65536)
            if not data:
                break
            if t_first is None:
                t_first = time.perf_counter() - t0
            got += len(data)
    t_total = time.perf_counter() - t0
    th.join(timeout=5)
    return {
        "protocol": "tcp",
        "bytes_requested": nbytes,
        "bytes_received": got,
        "connect_time_ms": round(t_connect * 1000, 4),
        "time_to_first_byte_ms": None if t_first is None else round(t_first * 1000, 4),
        "total_time_s": round(t_total, 5),
        "goodput_mbps": round(got * 8 / t_total / 1e6, 2),
        "complete": got == nbytes,
    }


def udp_trial(port: int, n_datagrams: int, payload: int, rcvbuf: int) -> dict[str, Any]:
    rx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    rx.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, rcvbuf)
    rx.bind((HOST, port))
    rx.settimeout(0.5)
    actual_rcvbuf = rx.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)
    seen: list[int] = []
    started = threading.Event()

    def receiver() -> None:
        started.set()
        try:
            while True:
                data, _ = rx.recvfrom(65535)
                seen.append(struct.unpack("!I", data[:4])[0])
        except socket.timeout:
            pass

    th = threading.Thread(target=receiver, daemon=True)
    th.start()
    started.wait()

    tx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    pad = b"\0" * (payload - 4)
    t0 = time.perf_counter()
    for i in range(n_datagrams):
        tx.sendto(struct.pack("!I", i) + pad, (HOST, port))
    t_send = time.perf_counter() - t0
    th.join(timeout=5)
    rx.close()
    tx.close()
    reordered = sum(1 for a, b in zip(seen, seen[1:]) if b < a)
    uniq = len(set(seen))
    return {
        "protocol": "udp",
        "datagrams_sent": n_datagrams,
        "datagrams_received": len(seen),
        "datagrams_lost": n_datagrams - uniq,
        "loss_fraction": round(1 - uniq / n_datagrams, 5),
        "reordered": reordered,
        "duplicates": len(seen) - uniq,
        "send_time_s": round(t_send, 5),
        "receiver_rcvbuf_bytes": actual_rcvbuf,
        "retransmissions": 0,
        "note": "UDP never retransmits; any loss here is kernel socket-buffer overflow on loopback "
                "(sender faster than the receiver thread), not network loss.",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bytes", type=int, default=50_000_000)
    ap.add_argument("--datagrams", type=int, default=50_000)
    ap.add_argument("--payload", type=int, default=1200)
    ap.add_argument("--rcvbuf", type=int, default=65536, help="UDP receive buffer (small => visible drops)")
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--tcp-port", type=int, default=5001)
    ap.add_argument("--udp-port", type=int, default=5002)
    ap.add_argument("--out")
    args = ap.parse_args()

    tcp = [tcp_trial(args.tcp_port + i, args.bytes) for i in range(args.repeats)]
    udp = [udp_trial(args.udp_port + i, args.datagrams, args.payload, args.rcvbuf) for i in range(args.repeats)]
    out = {
        "kind": "REAL socket measurements on loopback (not simulator output)",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "host": {"platform": platform.platform(), "python": platform.python_version()},
        "wireshark_capture_performed": False,
        "parameters": vars(args),
        "tcp": tcp,
        "udp": udp,
    }
    text = json.dumps(out, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(text)
        print(f"wrote {args.out}")
    print(text)


if __name__ == "__main__":
    main()
