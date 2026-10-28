"""
Simulation API: thin HTTP wrappers around the engine in ``app.simulation``.

All endpoints are synchronous (FastAPI runs them in a worker thread) and every
number returned comes from a simulator run - there is no canned data.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from app.simulation import export, lab
from app.simulation.config import (
    DEFAULT_LADDER_LABELS,
    NETWORK_PRESETS,
    ConfigError,
    SimulationConfig,
)
from app.simulation.experiment import run_session
from app.simulation.transport import SimulationError

router = APIRouter(tags=["simulation"])


def _bad_request(exc: Exception) -> HTTPException:
    return HTTPException(status_code=422, detail=str(exc))


class SimulateRequest(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)
    preset: Optional[str] = None


class CompareRequest(SimulateRequest):
    protocols: list[Literal["tcp", "udp", "quic"]] = ["tcp", "udp", "quic"]
    udp_recoveries: Optional[list[Literal["none", "arq", "fec"]]] = None
    n_trials: int = 1


class TrialsRequest(SimulateRequest):
    n_trials: int = 30


class AbrRequest(SimulateRequest):
    n_trials: int = 1
    strategies: list[Literal["throughput", "buffer"]] = ["throughput", "buffer"]


class SensitivityRequest(SimulateRequest):
    parameter: str
    values: list[float]
    n_trials: int = 10


class MathisRequest(BaseModel):
    loss_values: list[float] = [0.001, 0.003, 0.01, 0.03]
    rtt_ms_values: list[float] = [20.0, 50.0, 100.0, 200.0]
    n_trials: int = 10
    bandwidth_mbps: float = 1000.0
    base_seed: int = 1


class SweepRequest(SimulateRequest):
    loss_values: list[float]
    rtt_ms_values: list[float]
    n_trials: int = 3
    protocols: list[Literal["tcp", "udp", "quic"]] = ["tcp", "udp"]


class ExportRequest(BaseModel):
    format: Literal["json", "csv"]
    filename: str = "export"
    data: Any = None
    rows: Optional[list[dict[str, Any]]] = None


def _config(req: SimulateRequest) -> SimulationConfig:
    try:
        cfg = SimulationConfig.from_dict(req.config)
        if req.preset:
            cfg = lab.apply_preset(cfg, req.preset)
        return cfg
    except ConfigError as exc:
        raise _bad_request(exc) from exc


def _guard(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except (ConfigError, ValueError) as exc:
        raise _bad_request(exc) from exc
    except SimulationError as exc:
        raise HTTPException(status_code=500, detail=f"simulation failed: {exc}") from exc


@router.get("/defaults")
def defaults() -> dict[str, Any]:
    cfg = SimulationConfig()
    return {
        "config": cfg.to_dict(),
        "presets": {k: {**cfg.network.__dict__, **v} for k, v in NETWORK_PRESETS.items()},
        "ladder_labels": DEFAULT_LADDER_LABELS,
        "sensitivity_parameters": lab.SENSITIVITY_PARAMETERS,
        "max_trials": lab.MAX_TRIALS,
    }


@router.post("/simulate")
def simulate(req: SimulateRequest) -> dict[str, Any]:
    cfg = _config(req)
    return _guard(lambda: run_session(cfg).to_dict())


@router.post("/compare")
def compare(req: CompareRequest) -> dict[str, Any]:
    cfg = _config(req)
    if req.n_trials > 1:
        return _guard(lab.compare_transports_trials, cfg, req.n_trials, req.protocols, req.udp_recoveries)
    return _guard(lab.compare_transports, cfg, req.protocols, req.udp_recoveries)


@router.post("/trials")
def trials(req: TrialsRequest) -> dict[str, Any]:
    cfg = _config(req)
    return _guard(lab.run_trials, cfg, req.n_trials)


@router.post("/abr-compare")
def abr_compare(req: AbrRequest) -> dict[str, Any]:
    cfg = _config(req)
    return _guard(lab.compare_abr, cfg, req.strategies, req.n_trials)


@router.post("/sensitivity")
def sensitivity(req: SensitivityRequest) -> dict[str, Any]:
    cfg = _config(req)
    return _guard(lab.sensitivity, cfg, req.parameter, req.values, req.n_trials)


@router.post("/mathis")
def mathis(req: MathisRequest) -> dict[str, Any]:
    return _guard(lab.mathis_validation, req.loss_values, req.rtt_ms_values, req.n_trials,
                  req.bandwidth_mbps, req.base_seed)


@router.post("/sweep")
def sweep(req: SweepRequest) -> dict[str, Any]:
    cfg = _config(req)
    return _guard(lab.loss_rtt_sweep, cfg, req.loss_values, req.rtt_ms_values, req.n_trials,
                  req.protocols)


@router.post("/export")
def export_data(req: ExportRequest) -> Response:
    """Serialise supplied results as downloadable JSON or CSV (CSV needs ``rows``)."""
    safe = "".join(c for c in req.filename if c.isalnum() or c in "-_") or "export"
    if req.format == "csv":
        if req.rows is None:
            raise HTTPException(status_code=422, detail="CSV export needs 'rows'")
        body, media = export.rows_to_csv(req.rows), "text/csv"
    else:
        body, media = export.to_json(req.data if req.data is not None else req.rows), "application/json"
    return Response(content=body, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{safe}.{req.format}"'})
