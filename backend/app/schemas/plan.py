import uuid
from datetime import datetime

from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: uuid.UUID
    version: int
    plan_json: dict
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PlanVersionSummary(BaseModel):
    id: uuid.UUID
    version: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PlanRefineRequest(BaseModel):
    slide_id: str | None = None
    section_id: str | None = None
    instruction: str


class PlanRegenerateRequest(BaseModel):
    instruction: str


class PlanUpdateRequest(BaseModel):
    plan_json: dict


class PlanGenerateProgressiveResponse(BaseModel):
    task_id: str
    status: str


class PlanRetrySectionRequest(BaseModel):
    section_id: str
