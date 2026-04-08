"""Seed prompt_configs and brand_profiles from JSON exports.

Run: python -m seed_data.seed
Or called from app startup to ensure defaults exist.
"""

import asyncio
import json
import logging
import uuid
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).parent


async def seed_prompt_configs(db: AsyncSession) -> int:
    """Insert system prompt_configs that don't already exist."""
    path = SEED_DIR / "prompt_configs.json"
    if not path.exists():
        logger.warning("No prompt_configs.json found in seed_data/")
        return 0

    data = json.loads(path.read_text(encoding="utf-8"))
    from app.models.prompt_config import PromptConfig

    # Get existing system prompt keys
    result = await db.execute(
        select(PromptConfig.prompt_key).where(PromptConfig.user_id.is_(None))
    )
    existing_keys = set(result.scalars().all())

    inserted = 0
    for item in data:
        key = item["prompt_key"]
        if key in existing_keys:
            continue
        db.add(PromptConfig(
            id=uuid.uuid4(),
            prompt_key=key,
            prompt_text=item.get("prompt_text", ""),
            category=item.get("category", "global"),
            pipeline_stage=item.get("pipeline_stage"),
            display_name=item.get("display_name", key),
            description=item.get("description"),
            icon_name=item.get("icon_name", "Zap"),
            sort_order=item.get("sort_order", 0),
            is_active=item.get("is_active", True),
            variables=item.get("variables"),
            user_id=None,
        ))
        inserted += 1

    if inserted:
        await db.flush()
        logger.info("Seeded %d prompt_configs", inserted)
    return inserted


async def seed_brand_profiles(db: AsyncSession) -> int:
    """Insert system brand_profiles that don't already exist."""
    path = SEED_DIR / "brand_profiles.json"
    if not path.exists():
        logger.warning("No brand_profiles.json found in seed_data/")
        return 0

    data = json.loads(path.read_text(encoding="utf-8"))

    # Check existing by name (system profiles have user_id IS NULL)
    result = await db.execute(
        text("SELECT name FROM brand_profiles WHERE user_id IS NULL")
    )
    existing_names = set(r[0] for r in result.fetchall())

    inserted = 0
    for item in data:
        if item["name"] in existing_names:
            continue
        # Build column list dynamically from item keys
        cols = [k for k in item.keys() if k not in ("id",)]
        vals = {k: item[k] for k in cols}
        vals["id"] = str(uuid.uuid4())
        cols_sql = ", ".join(["id"] + cols)
        params_sql = ", ".join([":id"] + [f":{k}" for k in cols])
        await db.execute(text(f"INSERT INTO brand_profiles ({cols_sql}) VALUES ({params_sql})"), vals)
        inserted += 1

    if inserted:
        await db.flush()
        logger.info("Seeded %d brand_profiles", inserted)
    return inserted


async def run_all_seeds(db: AsyncSession) -> None:
    """Run all seed operations."""
    await seed_prompt_configs(db)
    await seed_brand_profiles(db)
    await db.commit()


if __name__ == "__main__":
    from app.database import async_session_factory

    async def main():
        logging.basicConfig(level=logging.INFO)
        async with async_session_factory() as db:
            await run_all_seeds(db)

    asyncio.run(main())
