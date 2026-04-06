import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.llm.claude_provider import AVAILABLE_MODELS as CLAUDE_MODELS
from app.llm.factory import get_provider
from app.llm.ollama_provider import OllamaProvider
from app.llm.openai_provider import AVAILABLE_MODELS as OPENAI_MODELS
from app.models.llm_config import (
    LLMConfig,
    decrypt_api_key,
    encrypt_api_key,
    mask_api_key,
)
from app.models.user import User
from app.schemas.llm import (
    LLMConfigCreate,
    LLMConfigResponse,
    LLMConfigUpdate,
    LLMProviderInfo,
    LLMTestRequest,
    LLMTestResponse,
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/llm", tags=["llm"])


def _config_to_response(cfg: LLMConfig) -> LLMConfigResponse:
    """Convert model to response with masked API key."""
    masked = None
    if cfg.api_key_encrypted:
        try:
            plain = decrypt_api_key(cfg.api_key_encrypted)
            masked = mask_api_key(plain)
        except Exception:
            masked = "****"
    return LLMConfigResponse(
        id=cfg.id,
        provider=cfg.provider,
        model_name=cfg.model_name,
        api_key_masked=masked,
        endpoint_url=cfg.endpoint_url,
        is_default=cfg.is_default,
        created_at=cfg.created_at,
    )


# ─── Providers ───────────────────────────────────────────────────────────────


@router.get("/providers", response_model=list[LLMProviderInfo])
async def list_providers(current_user: User = Depends(get_current_user)):
    """List available LLM providers with their models."""
    providers = []

    # Claude — available if system API key exists
    providers.append(
        LLMProviderInfo(
            provider="claude",
            display_name="Claude (Anthropic)",
            available=bool(settings.ANTHROPIC_API_KEY),
            requires_api_key=True,
            models=CLAUDE_MODELS,
        )
    )

    # OpenAI — available if user has key or system key exists
    providers.append(
        LLMProviderInfo(
            provider="openai",
            display_name="ChatGPT (OpenAI)",
            available=bool(settings.OPENAI_API_KEY),
            requires_api_key=True,
            models=OPENAI_MODELS,
        )
    )

    # Ollama — always listed, models fetched dynamically
    ollama = OllamaProvider(endpoint_url=settings.OLLAMA_BASE_URL)
    providers.append(
        LLMProviderInfo(
            provider="ollama",
            display_name="Local (Ollama)",
            available=True,
            requires_api_key=False,
            models=ollama.get_available_models(),
        )
    )

    return providers


# ─── Test connection ─────────────────────────────────────────────────────────


@router.post("/test", response_model=LLMTestResponse)
async def test_provider(
    body: LLMTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test an LLM provider by sending a simple prompt."""
    # Resolve API key: body > user config > env
    api_key = body.api_key
    if not api_key and body.provider != "ollama":
        # Check user's saved configs
        result = await db.execute(
            select(LLMConfig).where(
                LLMConfig.user_id == current_user.id,
                LLMConfig.provider == body.provider,
            )
        )
        cfg = result.scalar_one_or_none()
        if cfg and cfg.api_key_encrypted:
            try:
                api_key = decrypt_api_key(cfg.api_key_encrypted)
            except Exception:
                pass

    try:
        provider = get_provider(
            provider_name=body.provider,
            api_key=api_key,
            endpoint_url=body.endpoint_url,
            model=body.model,
        )
    except ValueError as e:
        return LLMTestResponse(success=False, message=str(e))

    model_used = body.model or getattr(provider, "default_model", "unknown")
    start = time.monotonic()
    try:
        result = await provider.generate(
            system_prompt="You are a test assistant. Return ONLY valid JSON.",
            user_prompt='Return this exact JSON: {"status": "ok", "provider": "'
            + body.provider
            + '"}',
            model=body.model,
            json_mode=True,
        )
        elapsed = (time.monotonic() - start) * 1000
        return LLMTestResponse(
            success=True,
            message=f"Connection successful. Response: {result}",
            latency_ms=round(elapsed, 1),
            model_used=model_used,
        )
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        return LLMTestResponse(
            success=False,
            message=f"Connection failed: {e}",
            latency_ms=round(elapsed, 1),
            model_used=model_used,
        )


# ─── User LLM configs CRUD ──────────────────────────────────────────────────


@router.get("/configs", response_model=list[LLMConfigResponse])
async def list_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's saved LLM configurations (masked keys)."""
    result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.user_id == current_user.id)
        .order_by(LLMConfig.created_at)
    )
    return [_config_to_response(c) for c in result.scalars().all()]


@router.post("/configs", response_model=LLMConfigResponse, status_code=201)
async def create_config(
    body: LLMConfigCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a new LLM configuration."""
    # If setting as default, clear other defaults for this user
    if body.is_default:
        existing = await db.execute(
            select(LLMConfig).where(
                LLMConfig.user_id == current_user.id,
                LLMConfig.is_default == True,  # noqa: E712
            )
        )
        for cfg in existing.scalars().all():
            cfg.is_default = False

    config = LLMConfig(
        id=uuid.uuid4(),
        user_id=current_user.id,
        provider=body.provider,
        model_name=body.model_name,
        api_key_encrypted=encrypt_api_key(body.api_key) if body.api_key else None,
        endpoint_url=body.endpoint_url,
        is_default=body.is_default,
    )
    db.add(config)
    await db.flush()
    return _config_to_response(config)


@router.put("/configs/{config_id}", response_model=LLMConfigResponse)
async def update_config(
    config_id: uuid.UUID,
    body: LLMConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing LLM config."""
    result = await db.execute(
        select(LLMConfig).where(
            LLMConfig.id == config_id,
            LLMConfig.user_id == current_user.id,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    update_data = body.model_dump(exclude_unset=True)

    # Handle api_key separately (encrypt before storing)
    if "api_key" in update_data:
        key_val = update_data.pop("api_key")
        config.api_key_encrypted = encrypt_api_key(key_val) if key_val else None

    # If setting as default, clear others
    if update_data.get("is_default"):
        existing = await db.execute(
            select(LLMConfig).where(
                LLMConfig.user_id == current_user.id,
                LLMConfig.is_default == True,  # noqa: E712
                LLMConfig.id != config_id,
            )
        )
        for cfg in existing.scalars().all():
            cfg.is_default = False

    for field, value in update_data.items():
        setattr(config, field, value)

    await db.flush()
    await db.refresh(config)
    return _config_to_response(config)


@router.delete("/configs/{config_id}", status_code=204)
async def delete_config(
    config_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an LLM config."""
    result = await db.execute(
        select(LLMConfig).where(
            LLMConfig.id == config_id,
            LLMConfig.user_id == current_user.id,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    await db.delete(config)
