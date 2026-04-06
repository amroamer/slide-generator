import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# --- Provider info ---

class LLMModelInfo(BaseModel):
    model_id: str
    model_name: str
    description: str


class LLMProviderInfo(BaseModel):
    provider: str
    display_name: str
    available: bool
    requires_api_key: bool
    models: list[LLMModelInfo]


# --- Config CRUD ---

class LLMConfigCreate(BaseModel):
    provider: str
    model_name: str
    api_key: str | None = None
    endpoint_url: str | None = None
    is_default: bool = False


class LLMConfigUpdate(BaseModel):
    provider: str | None = None
    model_name: str | None = None
    api_key: str | None = None
    endpoint_url: str | None = None
    is_default: bool | None = None


class LLMConfigResponse(BaseModel):
    id: uuid.UUID
    provider: str
    model_name: str
    api_key_masked: str | None = None
    endpoint_url: str | None = None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Test connection ---

class LLMTestRequest(BaseModel):
    provider: str
    model: str | None = None
    api_key: str | None = None
    endpoint_url: str | None = None


class LLMTestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: float | None = None
    model_used: str | None = None
