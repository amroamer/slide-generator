import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
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


def _config_to_response(cfg: LLMConfig) -> dict:
    """Convert model to response dict with masked API key — avoids lazy-load issues."""
    masked = None
    if cfg.api_key_encrypted:
        try:
            plain = decrypt_api_key(cfg.api_key_encrypted)
            masked = mask_api_key(plain)
        except Exception:
            masked = "****"
    return {
        "id": str(cfg.id),
        "provider": cfg.provider,
        "model_name": cfg.model_name,
        "api_key_masked": masked,
        "endpoint_url": cfg.endpoint_url,
        "is_default": cfg.is_default,
        "display_name": cfg.display_name,
        "provider_type": cfg.provider_type,
        "is_active": cfg.is_active,
        "last_tested_at": cfg.last_tested_at.isoformat() if cfg.last_tested_at else None,
        "last_test_status": cfg.last_test_status,
        "last_test_latency_ms": cfg.last_test_latency_ms,
        "last_test_error": cfg.last_test_error,
        "created_at": cfg.created_at.isoformat() if cfg.created_at else None,
    }


# ─── Providers ───────────────────────────────────────────────────────────────

@router.get("/providers")
async def list_providers(current_user: User = Depends(get_current_user)):
    """List available LLM providers with their models."""
    providers = []

    providers.append(LLMProviderInfo(
        provider="claude", display_name="Claude (Anthropic)",
        available=bool(settings.ANTHROPIC_API_KEY), requires_api_key=True, models=CLAUDE_MODELS,
    ))

    providers.append(LLMProviderInfo(
        provider="openai", display_name="ChatGPT (OpenAI)",
        available=bool(settings.OPENAI_API_KEY), requires_api_key=True, models=OPENAI_MODELS,
    ))

    ollama = OllamaProvider(endpoint_url=settings.OLLAMA_BASE_URL)
    providers.append(LLMProviderInfo(
        provider="ollama", display_name="Local (Ollama)",
        available=True, requires_api_key=False, models=ollama.get_available_models(),
    ))

    return providers


# ─── Test connection ─────────────────────────────────────────────────────────

@router.post("/test", response_model=LLMTestResponse)
async def test_provider(
    body: LLMTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test an LLM provider by sending a simple prompt. Optionally saves results to a config."""
    api_key = body.api_key
    if not api_key and body.provider != "ollama":
        result = await db.execute(
            select(LLMConfig).where(LLMConfig.user_id == current_user.id, LLMConfig.provider == body.provider)
        )
        cfg = result.scalar_one_or_none()
        if cfg and cfg.api_key_encrypted:
            try:
                api_key = decrypt_api_key(cfg.api_key_encrypted)
            except Exception:
                pass

    try:
        provider = get_provider(provider_name=body.provider, api_key=api_key, endpoint_url=body.endpoint_url, model=body.model)
    except ValueError as e:
        # Save failure if config_id provided
        if body.config_id:
            await _save_test_result(body.config_id, current_user.id, False, 0, str(e), db)
        return LLMTestResponse(success=False, message=str(e))

    model_used = body.model or getattr(provider, "default_model", "unknown")
    start = time.monotonic()
    try:
        result = await provider.generate(
            system_prompt="You are a test assistant. Return ONLY valid JSON.",
            user_prompt='Return this exact JSON: {"status": "ok", "provider": "' + body.provider + '"}',
            model=body.model, json_mode=True,
        )
        elapsed = round((time.monotonic() - start) * 1000, 1)
        if body.config_id:
            await _save_test_result(body.config_id, current_user.id, True, int(elapsed), None, db)
        return LLMTestResponse(success=True, message=f"Connected successfully", latency_ms=elapsed, model_used=model_used)
    except Exception as e:
        elapsed = round((time.monotonic() - start) * 1000, 1)
        if body.config_id:
            await _save_test_result(body.config_id, current_user.id, False, int(elapsed), str(e)[:500], db)
        return LLMTestResponse(success=False, message=f"Connection failed: {e}", latency_ms=elapsed, model_used=model_used)


async def _save_test_result(config_id: str, user_id: uuid.UUID, success: bool, latency: int, error: str | None, db: AsyncSession):
    cfg = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == uuid.UUID(config_id), LLMConfig.user_id == user_id)
    )).scalar_one_or_none()
    if cfg:
        cfg.last_tested_at = datetime.now(timezone.utc)
        cfg.last_test_status = "success" if success else "failed"
        cfg.last_test_latency_ms = latency
        cfg.last_test_error = error
        await db.flush()


# ─── User LLM configs CRUD ──────────────────────────────────────────────────

@router.get("/configs")
async def list_configs(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LLMConfig).where(LLMConfig.user_id == current_user.id).order_by(LLMConfig.created_at)
    )
    return [_config_to_response(c) for c in result.scalars().all()]


@router.post("/configs", status_code=201)
async def create_config(body: LLMConfigCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if body.is_default:
        existing = await db.execute(
            select(LLMConfig).where(LLMConfig.user_id == current_user.id, LLMConfig.is_default == True)  # noqa
        )
        for cfg in existing.scalars().all():
            cfg.is_default = False

    config = LLMConfig(
        user_id=current_user.id, provider=body.provider, model_name=body.model_name,
        api_key_encrypted=encrypt_api_key(body.api_key) if body.api_key else None,
        endpoint_url=body.endpoint_url, is_default=body.is_default,
        display_name=body.display_name or body.provider.capitalize(),
        provider_type=body.provider_type or body.provider,
        is_active=body.is_active,
    )
    db.add(config)
    await db.flush()
    return _config_to_response(config)


@router.put("/configs/{config_id}")
async def update_config(config_id: uuid.UUID, body: LLMConfigUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == config_id, LLMConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not config:
        raise HTTPException(404, "Config not found")

    update_data = body.model_dump(exclude_unset=True)
    if "api_key" in update_data:
        key_val = update_data.pop("api_key")
        config.api_key_encrypted = encrypt_api_key(key_val) if key_val else None

    if update_data.get("is_default"):
        existing = await db.execute(
            select(LLMConfig).where(LLMConfig.user_id == current_user.id, LLMConfig.is_default == True, LLMConfig.id != config_id)  # noqa
        )
        for cfg in existing.scalars().all():
            cfg.is_default = False

    for field, value in update_data.items():
        setattr(config, field, value)
    await db.flush()
    return _config_to_response(config)


@router.delete("/configs/{config_id}", status_code=204)
async def delete_config(config_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == config_id, LLMConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not config:
        raise HTTPException(404, "Config not found")
    await db.delete(config)


# ─── Activate / Deactivate ──────────────────────────────────────────────────

@router.put("/configs/{config_id}/activate")
async def activate_config(config_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == config_id, LLMConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not config:
        raise HTTPException(404)
    config.is_active = True
    await db.flush()
    return {"is_active": True}


@router.put("/configs/{config_id}/deactivate")
async def deactivate_config(config_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == config_id, LLMConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not config:
        raise HTTPException(404)
    config.is_active = False
    await db.flush()
    return {"is_active": False}


# ─── Default management ─────────────────────────────────────────────────────

class SetDefaultRequest(BaseModel):
    config_id: str


@router.get("/default")
async def get_default(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.user_id == current_user.id, LLMConfig.is_default == True)  # noqa
    )).scalar_one_or_none()
    if not config:
        return {"default": None}
    return {"default": _config_to_response(config)}


@router.put("/default")
async def set_default(body: SetDefaultRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Unset all defaults
    existing = await db.execute(
        select(LLMConfig).where(LLMConfig.user_id == current_user.id, LLMConfig.is_default == True)  # noqa
    )
    for cfg in existing.scalars().all():
        cfg.is_default = False

    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == uuid.UUID(body.config_id), LLMConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not config:
        raise HTTPException(404)
    config.is_default = True
    await db.flush()
    return {"default": _config_to_response(config)}


# ─── Fetch models for a provider/config ──────────────────────────────────────

@router.get("/configs/{config_id}/models")
async def get_config_models(config_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == config_id, LLMConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not config:
        raise HTTPException(404)

    if config.provider == "ollama":
        endpoint = config.endpoint_url or settings.OLLAMA_BASE_URL
        try:
            import httpx
            r = httpx.get(f"{endpoint.rstrip('/')}/api/tags", timeout=10)
            models = r.json().get("models", [])
            return [{"model_id": m["name"], "model_name": m["name"],
                     "description": f"{round(m.get('size', 0) / 1e9, 1)}GB",
                     "size": m.get("size", 0), "parameter_size": m.get("details", {}).get("parameter_size", ""),
                     "modified_at": m.get("modified_at", "")} for m in models]
        except Exception:
            return []
    elif config.provider in ("claude", "anthropic"):
        return CLAUDE_MODELS
    elif config.provider == "openai":
        return OPENAI_MODELS
    else:
        return []


# ─── Ollama model management ────────────────────────────────────────────────

class PullModelRequest(BaseModel):
    model_name: str


@router.post("/configs/{config_id}/models/pull")
async def pull_ollama_model(config_id: uuid.UUID, body: PullModelRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Pull a model from Ollama registry."""
    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == config_id, LLMConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not config or config.provider != "ollama":
        raise HTTPException(400, "Only Ollama providers support model pulling")
    endpoint = config.endpoint_url or settings.OLLAMA_BASE_URL
    import httpx
    try:
        r = httpx.post(f"{endpoint.rstrip('/')}/api/pull", json={"name": body.model_name, "stream": False}, timeout=600)
        return {"status": "success", "response": r.json()}
    except Exception as e:
        raise HTTPException(500, f"Pull failed: {e}")


class DeleteModelRequest(BaseModel):
    model_name: str


@router.post("/configs/{config_id}/models/delete")
async def delete_ollama_model(config_id: uuid.UUID, body: DeleteModelRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete a model from Ollama."""
    config = (await db.execute(
        select(LLMConfig).where(LLMConfig.id == config_id, LLMConfig.user_id == current_user.id)
    )).scalar_one_or_none()
    if not config or config.provider != "ollama":
        raise HTTPException(400, "Only Ollama providers")
    endpoint = config.endpoint_url or settings.OLLAMA_BASE_URL
    import httpx
    try:
        r = httpx.delete(f"{endpoint.rstrip('/')}/api/delete", json={"name": body.model_name}, timeout=30)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(500, f"Delete failed: {e}")
