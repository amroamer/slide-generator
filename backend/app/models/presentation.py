import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PresentationStatus(str, enum.Enum):
    draft = "draft"
    input_complete = "input_complete"
    plan_complete = "plan_complete"
    content_complete = "content_complete"
    design_complete = "design_complete"
    exported = "exported"


class PresentationLanguage(str, enum.Enum):
    english = "english"
    arabic = "arabic"
    bilingual = "bilingual"


# Map status → workflow step number (1-based)
STATUS_TO_STEP = {
    PresentationStatus.draft: 1,
    PresentationStatus.input_complete: 2,
    PresentationStatus.plan_complete: 3,
    PresentationStatus.content_complete: 4,
    PresentationStatus.design_complete: 5,
    PresentationStatus.exported: 5,
}


class Presentation(Base):
    __tablename__ = "presentations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(
        String(500), default="Untitled Presentation", nullable=False
    )
    status: Mapped[PresentationStatus] = mapped_column(
        Enum(PresentationStatus), default=PresentationStatus.draft, nullable=False
    )
    language: Mapped[PresentationLanguage] = mapped_column(
        Enum(PresentationLanguage),
        default=PresentationLanguage.english,
        nullable=False,
    )
    tone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    audience: Mapped[str | None] = mapped_column(String(100), nullable=True)
    slide_count: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    llm_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Pipeline tracking timestamps
    input_modified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    plan_modified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    content_modified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    design_modified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_exported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
