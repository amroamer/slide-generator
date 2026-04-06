import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BrandProfile(Base):
    __tablename__ = "brand_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Logo
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_position: Mapped[str] = mapped_column(String(20), nullable=False, default="top-right")
    logo_size: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    # Colors
    primary_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#00338D")
    secondary_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#0091DA")
    accent_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#483698")
    background_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#FFFFFF")
    text_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#1A1A2E")
    text_secondary_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#6B7280")
    chart_colors: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Fonts
    font_heading: Mapped[str] = mapped_column(String(100), nullable=False, default="Arial")
    font_body: Mapped[str] = mapped_column(String(100), nullable=False, default="Arial")
    font_size_title: Mapped[int] = mapped_column(Integer, nullable=False, default=28)
    font_size_subtitle: Mapped[int] = mapped_column(Integer, nullable=False, default=18)
    font_size_body: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    font_size_caption: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    # Slide master
    slide_header: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    slide_footer: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    slide_accent_line: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    slide_background_style: Mapped[str] = mapped_column(String(20), nullable=False, default="solid")
    slide_gradient: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Table styling
    table_header_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    table_header_text_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#FFFFFF")
    table_alternate_row: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    table_alternate_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#F5F7FA")
    table_border_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#E5E7EB")
    table_style: Mapped[str] = mapped_column(String(20), nullable=False, default="striped")

    # Chart styling
    chart_style: Mapped[str] = mapped_column(String(20), nullable=False, default="modern")
    chart_show_grid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    chart_show_legend: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    chart_legend_position: Mapped[str] = mapped_column(String(20), nullable=False, default="bottom")
    chart_bar_radius: Mapped[int] = mapped_column(Integer, nullable=False, default=4)

    # Meta
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
