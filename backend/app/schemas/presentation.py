import uuid
from datetime import datetime

from pydantic import BaseModel, Field, computed_field

from app.models.presentation import STATUS_TO_STEP, PresentationStatus


class PresentationCreate(BaseModel):
    title: str = "Untitled Presentation"


class PresentationUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    language: str | None = None
    tone: str | None = None
    audience: str | None = None
    slide_count: int | None = Field(None, ge=1, le=50)
    llm_provider: str | None = None
    llm_model: str | None = None


class PresentationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    status: str
    language: str
    tone: str | None = None
    audience: str | None = None
    slide_count: int
    llm_provider: str | None = None
    llm_model: str | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def current_step(self) -> int:
        try:
            return STATUS_TO_STEP[PresentationStatus(self.status)]
        except (ValueError, KeyError):
            return 1

    model_config = {"from_attributes": True}


class PresentationListResponse(BaseModel):
    items: list[PresentationResponse]
    total: int
    page: int
    page_size: int
