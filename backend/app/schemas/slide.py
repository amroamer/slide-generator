import uuid
from datetime import datetime

from pydantic import BaseModel


class SlideResponse(BaseModel):
    id: uuid.UUID
    presentation_id: uuid.UUID
    slide_id: str
    section: str
    order: int
    title: str
    content_json: dict | None = None
    layout: str | None = None
    design_json: dict | None = None
    template_variation_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SlideUpdateRequest(BaseModel):
    title: str | None = None
    content_json: dict | None = None


class SlideRefineRequest(BaseModel):
    instruction: str


class ContentRegenerateRequest(BaseModel):
    instruction: str | None = None
