import uuid
from datetime import datetime

from pydantic import BaseModel


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
    display_name: str | None = None
    provider_type: str | None = None
    is_active: bool = True


class LLMConfigUpdate(BaseModel):
    provider: str | None = None
    model_name: str | None = None
    api_key: str | None = None
    endpoint_url: str | None = None
    is_default: bool | None = None
    display_name: str | None = None
    is_active: bool | None = None


class LLMConfigResponse(BaseModel):
    id: uuid.UUID
    provider: str
    model_name: str
    api_key_masked: str | None = None
    endpoint_url: str | None = None
    is_default: bool
    display_name: str | None = None
    provider_type: str | None = None
    is_active: bool = True
    last_tested_at: datetime | None = None
    last_test_status: str | None = None
    last_test_latency_ms: int | None = None
    last_test_error: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Test connection ---

class LLMTestRequest(BaseModel):
    provider: str
    model: str | None = None
    api_key: str | None = None
    endpoint_url: str | None = None
    config_id: str | None = None  # If provided, save test results to this config


class LLMTestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: float | None = None
    model_used: str | None = None
