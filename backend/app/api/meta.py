from fastapi import APIRouter

from app import config
from app.models.schemas import HealthResponse, ProjectInfoResponse

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="streamlens-api")


@router.get("/info", response_model=ProjectInfoResponse)
def info() -> ProjectInfoResponse:
    return ProjectInfoResponse(
        name=config.PROJECT_NAME,
        subtitle=config.PROJECT_SUBTITLE,
        report_title=config.REPORT_TITLE,
        phase=config.CURRENT_PHASE,
        review_milestone=config.REVIEW_MILESTONE,
        modules_scaffolded=config.PLANNED_SIMULATION_MODULES,
    )
