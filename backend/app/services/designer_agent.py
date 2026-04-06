import json
import logging
import time
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_log import AgentLog
from app.models.presentation import Presentation, PresentationStatus
from app.models.presentation_input import PresentationInput
from app.models.slide import PresentationSlide
from app.models.user import User
from app.services.layout_engine import auto_assign_layout
from app.services.llm_resolver import resolve_llm

logger = logging.getLogger(__name__)


async def generate_designs(
    presentation_id: uuid.UUID, user: User, db: AsyncSession
) -> list[dict]:
    """Rule-based layout assignment. Instant — no LLM call."""
    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()

    slides_result = await db.execute(
        select(PresentationSlide)
        .where(PresentationSlide.presentation_id == presentation_id)
        .order_by(PresentationSlide.order)
    )
    slides = slides_result.scalars().all()

    reasons = []
    for sl in slides:
        layout, reason = auto_assign_layout(sl.content_json or {}, sl.title)
        sl.layout = layout
        sl.design_json = sl.design_json or {}
        reasons.append(f"{sl.slide_id}: {layout} ({reason})")

    log = AgentLog(
        id=uuid.uuid4(), presentation_id=presentation_id,
        step="design", agent_name="Designer Agent",
        llm_provider="rule-engine", llm_model="auto-assign",
        prompt_sent="Rule-based layout assignment",
        response_received="\n".join(reasons),
        latency_ms=0,
    )
    db.add(log)
    if pres.status != PresentationStatus.exported:
        pres.status = PresentationStatus.design_complete
    await db.flush()

    return [{"slide_id": sl.slide_id, "layout": sl.layout, "design_json": sl.design_json} for sl in slides]


async def redesign_slide(
    presentation_id: uuid.UUID, slide_id: str, instruction: str,
    user: User, db: AsyncSession,
) -> dict:
    """Per-slide redesign still uses LLM for AI-powered suggestions."""
    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()

    slide = (await db.execute(
        select(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id,
            PresentationSlide.slide_id == slide_id,
        )
    )).scalar_one()

    provider = await resolve_llm(
        user, db,
        presentation_provider=pres.llm_provider,
        presentation_model=pres.llm_model,
    )

    system_prompt = (
        "You are the Designer Agent. Redesign the layout for this single slide. "
        "Return ONLY valid JSON with slide_id, layout, and layout_config."
    )
    user_prompt = (
        f"CURRENT SLIDE:\n  slide_id: {slide.slide_id}\n  title: {slide.title}\n"
        f"  current_layout: {slide.layout}\n  current_config: {json.dumps(slide.design_json)}\n\n"
        f"USER INSTRUCTION: {instruction}\n\n"
        f"Return: {{\"slide_id\": \"{slide_id}\", \"layout\": \"...\", \"layout_config\": {{...}}}}"
    )

    start = time.monotonic()
    result = await provider.generate_with_retry(system_prompt, user_prompt, json_mode=True)
    latency = (time.monotonic() - start) * 1000

    slide.layout = result.get("layout", slide.layout)
    slide.design_json = result.get("layout_config", slide.design_json)

    log = AgentLog(
        id=uuid.uuid4(), presentation_id=presentation_id,
        step="design", agent_name="Designer Agent",
        llm_provider=provider.provider_name,
        llm_model=pres.llm_model or getattr(provider, "default_model", "unknown"),
        prompt_sent=user_prompt[:2000], response_received=json.dumps(result)[:5000],
        latency_ms=round(latency, 1),
    )
    db.add(log)
    await db.flush()

    return {"slide_id": slide.slide_id, "layout": slide.layout, "design_json": slide.design_json}
