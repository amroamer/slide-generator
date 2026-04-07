import uuid
from datetime import datetime
from pydantic import BaseModel


class TemplateCollectionCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    slide_type_category: str | None = None
    mapped_slide_types: list[str] | None = None


class TemplateCollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    slide_type_category: str | None = None
    mapped_slide_types: list[str] | None = None


class TemplateVariationResponse(BaseModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    variation_index: int
    variation_name: str
    auto_name: str | None = None
    custom_name: str | None = None
    thumbnail_path: str | None = None
    tags: list | None = None
    is_favorite: bool
    is_enabled: bool = True
    is_primary: bool = False
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
    slide_type_category: str | None = None
    mapped_slide_types: list[str] | None = None
    extracted_colors: list[str] | None = None
    created_at: datetime
    variations: list[TemplateVariationResponse] = []

    model_config = {"from_attributes": True}


class TemplateVariationUpdate(BaseModel):
    variation_name: str | None = None
    custom_name: str | None = None
    tags: list | None = None
    is_enabled: bool | None = None


class SetPrimaryRequest(BaseModel):
    variation_id: uuid.UUID
