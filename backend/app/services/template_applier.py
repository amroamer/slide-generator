"""Apply a template variation to a presentation slide."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.slide import PresentationSlide
from app.models.slide_template import TemplateVariation


def map_content_to_slots(content_json: dict, content_slots: list) -> dict:
    """Maps actual slide content into the template's content slots."""
    mapping = {}

    title_slots = [s for s in content_slots if s["slot_type"] == "title"]
    if title_slots:
        mapping[title_slots[0]["shape_index"]] = content_json.get("title", "")

    subtitle_slots = [s for s in content_slots if s["slot_type"] == "subtitle"]
    if subtitle_slots:
        mapping[subtitle_slots[0]["shape_index"]] = content_json.get("key_takeaway", "")

    item_slots = [s for s in content_slots if s["slot_type"] == "item"]
    body = content_json.get("body", {})
    body_items = body.get("content", []) if isinstance(body, dict) else []

    for i, slot in enumerate(item_slots):
        if i < len(body_items):
            mapping[slot["shape_index"]] = body_items[i]
        else:
            mapping[slot["shape_index"]] = ""

    return mapping


async def apply_variation_to_slide(
    variation_id: uuid.UUID,
    presentation_id: uuid.UUID,
    slide_id: str,
    db: AsyncSession,
) -> dict:
    """Apply a template variation to a presentation slide."""
    # Load variation
    variation = (await db.execute(
        select(TemplateVariation).where(TemplateVariation.id == variation_id)
    )).scalar_one()

    # Load slide
    slide = (await db.execute(
        select(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id,
            PresentationSlide.slide_id == slide_id,
        )
    )).scalar_one()

    # Map content to template slots
    content_slots = (variation.design_json or {}).get("content_slots", [])
    content_mapping = map_content_to_slots(slide.content_json or {}, content_slots)

    # Store template reference on the slide
    slide.design_json = {
        **(slide.design_json or {}),
        "template_variation_id": str(variation.id),
        "template_collection_id": str(variation.collection_id),
        "template_variation_name": variation.variation_name,
        "content_mapping": content_mapping,
        "template_design": variation.design_json,
    }

    # Increment usage count
    variation.usage_count += 1

    await db.flush()
    await db.refresh(slide)

    return {
        "slide_id": slide.slide_id,
        "layout": slide.layout,
        "design_json": slide.design_json,
        "template_applied": variation.variation_name,
    }
