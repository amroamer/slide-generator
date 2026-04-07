import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TemplateCollection(Base):
    __tablename__ = "template_collections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_filename: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    source_file_path: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    variation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    slide_type_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mapped_slide_types: Mapped[list | None] = mapped_column(JSON, nullable=True)
    extracted_colors: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class TemplateVariation(Base):
    __tablename__ = "template_variations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("template_collections.id", ondelete="CASCADE"), nullable=False
    )
    variation_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    variation_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    auto_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    custom_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    layout_template_key: Mapped[str | None] = mapped_column(String(50), nullable=True, default="full_width")
    design_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    objects_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pptx_slide_xml: Mapped[str | None] = mapped_column(Text, nullable=True)
    pptx_rels_xml: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedded_images: Mapped[list | None] = mapped_column(JSON, nullable=True)
    metrics_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
