"""
Pydantic response models currently served by the API.

Request/config models for running experiments (NetworkConfig, VideoConfig,
ExperimentRequest, ExperimentResult, etc. — see section 53 of the project
brief) are added in Review 2 alongside the simulation engine they describe.
"""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str


class ProjectInfoResponse(BaseModel):
    name: str
    subtitle: str
    report_title: str
    phase: str
    review_milestone: int
    modules_scaffolded: list[str]
