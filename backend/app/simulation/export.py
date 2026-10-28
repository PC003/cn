"""
Result export: JSON and CSV serialisation of simulator output.

CSV export flattens a list of row dictionaries (nested dicts become
``parent.child`` columns); JSON export preserves the full structure. Both are
pure functions so they can be used from the API, the CLI and tests.
"""

from __future__ import annotations

import csv
import io
import json
from typing import Any, Iterable, Mapping

SESSION_TABLES = ("segments", "events", "timeline", "packet_trace", "metrics", "qoe")


def flatten(row: Mapping[str, Any], prefix: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        key = f"{prefix}{k}"
        if isinstance(v, Mapping):
            out.update(flatten(v, f"{key}."))
        elif isinstance(v, (list, tuple)):
            out[key] = json.dumps(v)
        else:
            out[key] = v
    return out


def rows_to_csv(rows: Iterable[Mapping[str, Any]]) -> str:
    flat = [flatten(r) for r in rows]
    if not flat:
        return ""
    columns: list[str] = []
    for r in flat:
        for k in r:
            if k not in columns:
                columns.append(k)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n")
    w.writeheader()
    for r in flat:
        w.writerow({c: ("" if r.get(c) is None else r.get(c)) for c in columns})
    return buf.getvalue()


def to_json(obj: Any, indent: int = 2) -> str:
    return json.dumps(obj, indent=indent, sort_keys=False, default=_default, allow_nan=False)


def _default(o: Any) -> Any:
    if hasattr(o, "to_dict"):
        return o.to_dict()
    if hasattr(o, "item"):  # numpy scalar
        return o.item()
    raise TypeError(f"not JSON serialisable: {type(o).__name__}")


def session_table(result: Mapping[str, Any], table: str) -> list[dict[str, Any]]:
    """Return one tabular view of a session result as a list of rows."""
    if table not in SESSION_TABLES:
        raise ValueError(f"table must be one of {SESSION_TABLES}")
    data = result[table]
    if isinstance(data, Mapping):
        return [dict(data)]
    return [dict(r) for r in data]


def session_to_csv(result: Mapping[str, Any], table: str = "segments") -> str:
    return rows_to_csv(session_table(result, table))
