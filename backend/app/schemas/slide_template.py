import uuid
from datetime import datetime
from pydantic import BaseModel


class TemplateCollectionCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None


class TemplateCollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None


class TemplateVariationResponse(BaseModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    variation_index: int
    variation_name: str
    thumbnail_path: str | None = None
    tags: list | None = None
    is_favorite: bool
    usage_count: int
    design_summary: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateCollectionResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    source_filename: str
    variation_count: int
    is_system: bool
    created_at: datetime
    variations: list[TemplateVariationResponse] = []

    model_config = {"from_attributes": True}


class TemplateVariationUpdate(BaseModel):
    variation_name: str | None = None
    tags: list | None = None
