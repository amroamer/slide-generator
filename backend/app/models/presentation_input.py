import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PresentationInput(Base):
    __tablename__ = "presentation_inputs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    presentation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("presentations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    raw_data_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    file_paths: Mapped[list | None] = mapped_column(JSON, nullable=True)
    audience: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language: Mapped[str | None] = mapped_column(String(20), nullable=True)
    slide_count: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    brand_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    parsed_data_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
