"""Central prompt resolution service — user override > system default > code fallback."""

import logging
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prompt_config import PromptConfig

logger = logging.getLogger(__name__)


class SafeDict(dict):
    """Returns '{key}' for missing keys instead of raising KeyError."""
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


async def resolve(
    prompt_key: str,
    user_id: uuid.UUID | None,
    db: AsyncSession,
    variables: dict[str, str] | None = None,
) -> str:
    """Get the effective prompt text: user override > system default."""
    filters = [
        PromptConfig.prompt_key == prompt_key,
        PromptConfig.is_active == True,  # noqa: E712
    ]
    if user_id:
        filters.append(or_(PromptConfig.user_id == user_id, PromptConfig.user_id.is_(None)))
    else:
        filters.append(PromptConfig.user_id.is_(None))

    result = await db.execute(
        select(PromptConfig)
        .where(*filters)
        .order_by(PromptConfig.user_id.desc().nulls_last())
        .limit(1)
    )
    row = result.scalar_one_or_none()

    if not row:
        logger.debug("Prompt %s not found in DB", prompt_key)
        return ""

    template = row.prompt_text
    if variables:
        template = template.format_map(SafeDict(variables))
    return template


async def resolve_composed(
    base_key: str,
    modifier_keys: list[str],
    user_id: uuid.UUID | None,
    db: AsyncSession,
    variables: dict[str, str] | None = None,
) -> str:
    """Resolve a base prompt + append modifier prompts (language, tone)."""
    parts = []
    base = await resolve(base_key, user_id, db, variables)
    if base:
        parts.append(base)
    for mk in modifier_keys:
        part = await resolve(mk, user_id, db, variables)
        if part:
            parts.append(part)
    return "\n\n".join(parts)


async def get_quick_actions(
    category: str,
    user_id: uuid.UUID | None,
    db: AsyncSession,
) -> list[dict]:
    """Get active quick actions: user overrides merged with system defaults."""
    # Get all system defaults for this category
    sys_result = await db.execute(
        select(PromptConfig)
        .where(
            PromptConfig.category == category,
            PromptConfig.user_id.is_(None),
            PromptConfig.is_active == True,  # noqa: E712
        )
        .order_by(PromptConfig.sort_order)
    )
    system_prompts = {p.prompt_key: p for p in sys_result.scalars().all()}

    # Get user overrides and custom actions
    user_prompts: dict[str, PromptConfig] = {}
    if user_id:
        usr_result = await db.execute(
            select(PromptConfig)
            .where(
                PromptConfig.category == category,
                PromptConfig.user_id == user_id,
                PromptConfig.is_active == True,  # noqa: E712
            )
            .order_by(PromptConfig.sort_order)
        )
        user_prompts = {p.prompt_key: p for p in usr_result.scalars().all()}

    # Merge: user override > system default, plus custom user actions
    actions = []
    seen_keys = set()

    # System defaults (with user overrides applied)
    for key, sys_p in system_prompts.items():
        p = user_prompts.get(key, sys_p)
        actions.append({
            "name": key.split(".")[-1],  # e.g., "data_driven" from "qa.planner.data_driven"
            "label": p.display_name,
            "icon_name": p.icon_name or "sparkles",
            "prompt": p.prompt_text,
            "is_custom": False,
        })
        seen_keys.add(key)

    # Custom user actions not in system defaults
    for key, usr_p in user_prompts.items():
        if key not in seen_keys:
            actions.append({
                "name": key.split(".")[-1],
                "label": usr_p.display_name,
                "icon_name": usr_p.icon_name or "sparkles",
                "prompt": usr_p.prompt_text,
                "is_custom": True,
            })

    return actions
