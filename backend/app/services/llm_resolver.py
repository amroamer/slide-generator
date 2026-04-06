from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.llm.base import LLMProvider
from app.llm.factory import get_provider
from app.models.llm_config import LLMConfig, decrypt_api_key
from app.models.user import User


async def resolve_llm(
    user: User,
    db: AsyncSession,
    presentation_provider: str | None = None,
    presentation_model: str | None = None,
) -> LLMProvider:
    """Resolve the LLM provider for a request.

    Priority:
    1. Per-presentation override (provider/model)
    2. User defaults (user.default_llm_provider/model)
    3. System defaults (env DEFAULT_LLM_PROVIDER/MODEL)

    API key lookup: user's llm_configs table, then env vars.
    """
    # Determine provider name and model
    provider_name = (
        presentation_provider
        or user.default_llm_provider
        or settings.DEFAULT_LLM_PROVIDER
    )
    model = (
        presentation_model
        or user.default_llm_model
        or settings.DEFAULT_LLM_MODEL
    )

    # Resolve API key from user configs or env
    api_key: str | None = None
    endpoint_url: str | None = None

    result = await db.execute(
        select(LLMConfig).where(
            LLMConfig.user_id == user.id,
            LLMConfig.provider == provider_name,
        )
    )
    user_config = result.scalar_one_or_none()

    if user_config:
        if user_config.api_key_encrypted:
            try:
                api_key = decrypt_api_key(user_config.api_key_encrypted)
            except Exception:
                pass
        if user_config.endpoint_url:
            endpoint_url = user_config.endpoint_url

    return get_provider(
        provider_name=provider_name,
        api_key=api_key,
        endpoint_url=endpoint_url,
        model=model,
    )
