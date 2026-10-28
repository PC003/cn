"""
Command-line interface to the simulator (no web server needed).

Examples (from ``backend/`` with the virtualenv active)::

    python -m app.cli run --preset mobile_4g --protocol tcp --seed 7
    python -m app.cli compare --preset lossy --seed 3 --out results/compare.json
    python -m app.cli trials --protocol udp --n 30 --csv results/trials.csv
    python -m app.cli mathis --n 10 --out results/mathis.json
    python -m app.cli sensitivity --param abr.safety_factor --values 0.5,0.7,0.9,1.0 --n 10
    python -m app.cli abr --preset sudden_drop --n 30

Any command accepts ``--config file.json`` (a SimulationConfig object) and the
shortcut flags below, which are applied on top of it.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Optional

from app.simulation import export, lab
from app.simulation.config import ConfigError, SimulationConfig
from app.simulation.experiment import run_session


def _load_config(args: argparse.Namespace) -> SimulationConfig:
    data: dict[str, Any] = {}
    if args.config:
        data = json.loads(Path(args.config).read_text())
    cfg = SimulationConfig.from_dict(data)
    if args.preset:
        cfg = lab.apply_preset(cfg, args.preset)
    if args.seed is not None:
        cfg = cfg.replace(seed=args.seed)
    if args.protocol:
        cfg = cfg.with_value("transport.protocol", args.protocol)
    if args.abr:
        cfg = cfg.with_value("abr.strategy", args.abr)
    if args.loss is not None:
        cfg = cfg.with_value("network.loss_probability", args.loss)
    if args.rtt is not None:
        cfg = cfg.with_value("network.rtt_ms", args.rtt)
    if args.bandwidth is not None:
        cfg = cfg.with_value("network.bandwidth_mbps", args.bandwidth)
    return cfg


def _emit(obj: Any, out: Optional[str]) -> None:
    text = export.to_json(obj)
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(text)
        print(f"wrote {out}")
    else:
        print(text)


def _write_csv(rows: list[dict[str, Any]], path: Optional[str]) -> None:
    if path:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(export.rows_to_csv(rows))
        print(f"wrote {path}")


def _brief(m: dict[str, Any]) -> str:
    return (f"QoE {m['qoe']:.1f} | avg {m['avg_bitrate_mbps']:.2f} Mbps | startup "
            f"{m['startup_delay_s']:.2f}s | rebuffer {m['rebuffer_s']:.2f}s x{m['rebuffer_events']} "
            f"| switches {m['bitrate_switches']} | retx {m['retransmissions']} "
            f"| timeouts {m['timeouts']} | HOL {m['hol_blocked_packet_s']:.1f} pkt-s")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--config", help="JSON file with a SimulationConfig")
    common.add_argument("--preset", help="network preset name")
    common.add_argument("--seed", type=int)
    common.add_argument("--protocol", choices=["tcp", "udp", "quic"])
    common.add_argument("--abr", choices=["throughput", "buffer"])
    common.add_argument("--loss", type=float, help="loss probability, e.g. 0.01 for 1%%")
    common.add_argument("--rtt", type=float, help="RTT in ms")
    common.add_argument("--bandwidth", type=float, help="mean bandwidth in Mbps")
    common.add_argument("--out", help="write JSON here instead of stdout")
    common.add_argument("--csv", help="also write a CSV table here")

    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run", parents=[common], help="one streaming session")
    sub.add_parser("compare", parents=[common], help="TCP vs UDP vs QUIC, same seed")
    t = sub.add_parser("trials", parents=[common], help="repeated seeds with 95%% CIs")
    t.add_argument("--n", type=int, default=30)
    c = sub.add_parser("compare-trials", parents=[common], help="repeated seeds, all transports")
    c.add_argument("--n", type=int, default=30)
    m = sub.add_parser("mathis", help="TCP-like throughput vs Mathis approximation")
    m.add_argument("--n", type=int, default=10)
    m.add_argument("--out")
    m.add_argument("--csv")
    a = sub.add_parser("abr", parents=[common], help="throughput vs buffer ABR")
    a.add_argument("--n", type=int, default=30)
    s = sub.add_parser("sensitivity", parents=[common], help="sweep one parameter")
    s.add_argument("--param", required=True, choices=sorted(lab.SENSITIVITY_PARAMETERS))
    s.add_argument("--values", required=True, help="comma separated numbers")
    s.add_argument("--n", type=int, default=10)
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.cmd == "mathis":
            res = lab.mathis_validation(n_trials=args.n)
            _emit(res, args.out)
            _write_csv(res["rows"], args.csv)
            return 0
        cfg = _load_config(args)
        if args.cmd == "run":
            res = run_session(cfg).to_dict()
            print(_brief(res["metrics"]), file=sys.stderr)
            _emit(res, args.out)
            _write_csv(export.session_table(res, "segments"), args.csv)
        elif args.cmd == "compare":
            res = lab.compare_transports(cfg, ("tcp", "udp", "quic"))
            for r in res["runs"]:
                print(f"{r['label']:>6}: {_brief(r['result']['metrics'])}", file=sys.stderr)
            _emit(res, args.out)
            _write_csv([{"label": r["label"], **r["result"]["metrics"]} for r in res["runs"]], args.csv)
        elif args.cmd == "trials":
            res = lab.run_trials(cfg, args.n)
            q = res["summary"]["qoe"]
            print(f"{res['n_ok']}/{res['n_requested']} runs ok | QoE {q['mean']:.2f} "
                  f"[{q['ci_low']:.2f}, {q['ci_high']:.2f}]", file=sys.stderr)
            _emit(res, args.out)
            _write_csv(res["per_trial"], args.csv)
        elif args.cmd == "compare-trials":
            res = lab.compare_transports_trials(cfg, args.n, ("tcp", "udp", "quic"),
                                                 udp_recoveries=("none", "arq", "fec"))
            for v in res["variants"]:
                q = v["summary"]["qoe"]
                print(f"{v['label']:>10}: QoE {q['mean']:.2f} +/- {q['ci_half_width']:.2f}", file=sys.stderr)
            _emit(res, args.out)
        elif args.cmd == "abr":
            res = lab.compare_abr(cfg, n_trials=args.n)
            _emit(res, args.out)
        elif args.cmd == "sensitivity":
            vals = [float(x) for x in args.values.split(",")]
            res = lab.sensitivity(cfg, args.param, vals, args.n)
            _emit(res, args.out)
            _write_csv([{"value": p_["value"], **{f"{k}.mean": v["mean"]
                          for k, v in p_.get("summary", {}).items()}} for p_ in res["points"]], args.csv)
        return 0
    except (ConfigError, ValueError, json.JSONDecodeError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
