import uuid
from datetime import datetime

from pydantic import BaseModel


class PromptConfigResponse(BaseModel):
    id: uuid.UUID
    prompt_key: str
    prompt_text: str
    category: str
    variables: dict | None = None
    is_active: bool
    is_system: bool = False
    is_overridden: bool = False
    display_name: str
    description: str | None = None
    icon_name: str | None = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PromptConfigCreate(BaseModel):
    prompt_key: str | None = None
    prompt_text: str
    category: str
    variables: dict | None = None
    display_name: str
    description: str | None = None
    icon_name: str | None = None


class PromptConfigUpdate(BaseModel):
    prompt_text: str | None = None
    is_active: bool | None = None
    display_name: str | None = None
    description: str | None = None
    icon_name: str | None = None


class PromptTestRequest(BaseModel):
    prompt_text: str
    variables: dict[str, str] = {}
    run_llm: bool = False
    llm_provider: str | None = None
    llm_model: str | None = None


class PromptTestResponse(BaseModel):
    rendered_text: str
    llm_response: str | None = None
    latency_ms: float | None = None
