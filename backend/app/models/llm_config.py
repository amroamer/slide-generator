import base64
import uuid
from datetime import datetime

from cryptography.fernet import Fernet
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.config import settings
from app.database import Base


def _get_fernet() -> Fernet:
    """Derive a Fernet key from SECRET_KEY (must be 32 url-safe base64 bytes)."""
    # Pad/hash the secret to exactly 32 bytes, then base64-encode for Fernet
    raw = settings.SECRET_KEY.encode("utf-8")[:32].ljust(32, b"\0")
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def encrypt_api_key(plain_key: str) -> str:
    """Encrypt an API key for storage."""
    return _get_fernet().encrypt(plain_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt a stored API key."""
    return _get_fernet().decrypt(encrypted_key.encode("utf-8")).decode("utf-8")


def mask_api_key(plain_key: str) -> str:
    """Return a masked version like 'sk-ant-...XXXX'."""
    if len(plain_key) <= 8:
        return "****"
    return plain_key[:7] + "..." + plain_key[-4:]


class LLMConfig(Base):
    __tablename__ = "llm_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    endpoint_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_test_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_test_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_test_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
