import json
import logging
import time
import uuid

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_log import AgentLog
from app.models.presentation import Presentation, PresentationStatus
from app.models.presentation_input import PresentationInput
from app.models.presentation_plan import PresentationPlan
from app.models.user import User
from app.prompts.planner import build_planner_system_prompt, build_planner_user_prompt
from app.services.llm_resolver import resolve_llm
from app.services import prompt_service

logger = logging.getLogger(__name__)


def _validate_plan(plan: dict) -> bool:
    """Check that plan has expected structure."""
    if not isinstance(plan, dict):
        return False
    sections = plan.get("sections")
    if not isinstance(sections, list) or len(sections) == 0:
        return False
    for section in sections:
        if not isinstance(section, dict):
            return False
        if "slides" not in section or not isinstance(section["slides"], list):
            return False
    return True


async def _get_next_version(presentation_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PresentationPlan.version), 0)).where(
            PresentationPlan.presentation_id == presentation_id
        )
    )
    return (result.scalar() or 0) + 1


async def _deactivate_plans(presentation_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )
    for plan in result.scalars().all():
        plan.is_active = False


async def _save_plan(
    presentation_id: uuid.UUID, plan_json: dict, db: AsyncSession
) -> PresentationPlan:
    await _deactivate_plans(presentation_id, db)
    version = await _get_next_version(presentation_id, db)
    plan = PresentationPlan(
        id=uuid.uuid4(),
        presentation_id=presentation_id,
        version=version,
        plan_json=plan_json,
        is_active=True,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


async def _log_agent(
    presentation_id: uuid.UUID,
    provider_name: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    response_json: dict,
    latency_ms: float,
    db: AsyncSession,
):
    log = AgentLog(
        id=uuid.uuid4(),
        presentation_id=presentation_id,
        step="plan",
        agent_name="Planner Agent",
        llm_provider=provider_name,
        llm_model=model,
        prompt_sent=f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}",
        response_received=json.dumps(response_json)[:10000],
        reasoning=None,
        latency_ms=round(latency_ms, 1),
    )
    db.add(log)


async def generate_plan(
    presentation_id: uuid.UUID, user: User, db: AsyncSession
) -> dict:
    """Generate a new presentation plan using the Planner Agent."""
    # Load presentation and input
    pres_result = await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )
    pres = pres_result.scalar_one()

    inp_result = await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )
    inp = inp_result.scalar_one()

    # Resolve LLM
    provider = await resolve_llm(
        user, db,
        presentation_provider=pres.llm_provider,
        presentation_model=pres.llm_model,
    )

    # Build prompts — try DB-configured prompts first, fall back to hardcoded
    lang = inp.language or "english"
    tone = inp.tone or "Client-Facing Professional"

    # Build modifier keys for composition
    modifier_keys = []
    if lang == "arabic":
        modifier_keys.append("planner.system.lang.arabic")
    elif lang == "bilingual":
        modifier_keys.append("planner.system.lang.bilingual")
    tone_map = {
        "Formal Board-Level": "planner.system.tone.formal_board",
        "Client-Facing Professional": "planner.system.tone.client_facing",
        "Internal Working Session": "planner.system.tone.internal_working",
    }
    if tone in tone_map:
        modifier_keys.append(tone_map[tone])

    # Try DB-configured system prompt
    db_system = await prompt_service.resolve_composed("planner.system", modifier_keys, user.id, db)
    system_prompt = db_system if db_system else build_planner_system_prompt(language=lang, tone=tone)

    # User prompt always uses the hardcoded builder (complex data formatting logic)
    user_prompt = build_planner_user_prompt(
        prompt=inp.prompt,
        data_summary=inp.raw_data_json,
        audience=inp.audience or "General",
        tone=tone,
        slide_count=inp.slide_count,
    )

    # Call LLM
    model = pres.llm_model or getattr(provider, "default_model", "unknown")
    start = time.monotonic()
    plan_json = await provider.generate_with_retry(
        system_prompt, user_prompt, json_mode=True
    )
    latency = (time.monotonic() - start) * 1000

    # Validate
    if not _validate_plan(plan_json):
        # Retry with stricter prompt
        start2 = time.monotonic()
        plan_json = await provider.generate(
            system_prompt,
            user_prompt + "\n\nCRITICAL: Your response must contain a 'sections' array with at least one section, each containing a 'slides' array.",
            json_mode=True,
        )
        latency += (time.monotonic() - start2) * 1000
        if not _validate_plan(plan_json):
            raise ValueError("LLM returned invalid plan structure after retries")

    # Save plan
    plan = await _save_plan(presentation_id, plan_json, db)

    # Log
    await _log_agent(
        presentation_id, provider.provider_name, model,
        system_prompt, user_prompt, plan_json, latency, db,
    )

    # Advance status forward only — don't regress if already past plan
    if pres.status in (PresentationStatus.draft, PresentationStatus.input_complete):
        pres.status = PresentationStatus.plan_complete
    await db.flush()

    return {"id": str(plan.id), "version": plan.version, "plan_json": plan_json}


async def refine_slide(
    presentation_id: uuid.UUID,
    slide_id: str,
    instruction: str,
    user: User,
    db: AsyncSession,
) -> dict:
    """Refine a single slide in the active plan."""
    plan_result = await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )
    plan = plan_result.scalar_one()
    plan_data = plan.plan_json

    # Find target slide and context
    target_slide = None
    prev_title = next_title = None
    for section in plan_data.get("sections", []):
        slides = section.get("slides", [])
        for i, sl in enumerate(slides):
            if sl.get("slide_id") == slide_id:
                target_slide = sl
                if i > 0:
                    prev_title = slides[i - 1].get("slide_title")
                if i < len(slides) - 1:
                    next_title = slides[i + 1].get("slide_title")
                break
        if target_slide:
            break

    if not target_slide:
        raise ValueError(f"Slide {slide_id} not found in plan")

    pres_result = await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )
    pres = pres_result.scalar_one()
    provider = await resolve_llm(
        user, db,
        presentation_provider=pres.llm_provider,
        presentation_model=pres.llm_model,
    )
    system_prompt = (
        "You are the Planner Agent. Refine the given slide based on the user's instruction. "
        "Return ONLY the updated slide as valid JSON matching the original slide schema."
    )
    user_prompt = (
        f"CURRENT SLIDE:\n{json.dumps(target_slide, indent=2)}\n\n"
        f"PREVIOUS SLIDE TITLE: {prev_title or 'N/A'}\n"
        f"NEXT SLIDE TITLE: {next_title or 'N/A'}\n\n"
        f"USER INSTRUCTION: {instruction}\n\n"
        f"Return the updated slide JSON only."
    )

    start = time.monotonic()
    updated = await provider.generate_with_retry(system_prompt, user_prompt, json_mode=True)
    latency = (time.monotonic() - start) * 1000

    # Preserve slide_id
    updated["slide_id"] = slide_id

    # Replace in plan
    for section in plan_data["sections"]:
        for i, sl in enumerate(section["slides"]):
            if sl["slide_id"] == slide_id:
                section["slides"][i] = updated
                break

    new_plan = await _save_plan(presentation_id, plan_data, db)
    await _log_agent(
        presentation_id, provider.provider_name,
        getattr(provider, "default_model", "unknown"),
        system_prompt, user_prompt, updated, latency, db,
    )

    return {"id": str(new_plan.id), "version": new_plan.version, "plan_json": plan_data}


async def refine_section(
    presentation_id: uuid.UUID,
    section_id: str,
    instruction: str,
    user: User,
    db: AsyncSession,
) -> dict:
    """Refine all slides in a section."""
    plan_result = await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )
    plan = plan_result.scalar_one()
    plan_data = plan.plan_json

    target_section = None
    for section in plan_data.get("sections", []):
        if section.get("section_id") == section_id:
            target_section = section
            break
    if not target_section:
        raise ValueError(f"Section {section_id} not found")

    pres_result = await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )
    pres = pres_result.scalar_one()
    provider = await resolve_llm(
        user, db,
        presentation_provider=pres.llm_provider,
        presentation_model=pres.llm_model,
    )
    system_prompt = (
        "You are the Planner Agent. Refine the given section based on the user's instruction. "
        "Return ONLY the updated section as valid JSON matching the original section schema."
    )
    user_prompt = (
        f"CURRENT SECTION:\n{json.dumps(target_section, indent=2)}\n\n"
        f"USER INSTRUCTION: {instruction}\n\n"
        f"Return the updated section JSON with the same section_id."
    )

    start = time.monotonic()
    updated = await provider.generate_with_retry(system_prompt, user_prompt, json_mode=True)
    latency = (time.monotonic() - start) * 1000

    updated["section_id"] = section_id

    for i, section in enumerate(plan_data["sections"]):
        if section["section_id"] == section_id:
            plan_data["sections"][i] = updated
            break

    new_plan = await _save_plan(presentation_id, plan_data, db)
    await _log_agent(
        presentation_id, provider.provider_name,
        getattr(provider, "default_model", "unknown"),
        system_prompt, user_prompt, updated, latency, db,
    )

    return {"id": str(new_plan.id), "version": new_plan.version, "plan_json": plan_data}


async def regenerate_full_plan(
    presentation_id: uuid.UUID,
    instruction: str,
    user: User,
    db: AsyncSession,
) -> dict:
    """Regenerate entire plan with additional user instruction."""
    inp_result = await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )
    inp = inp_result.scalar_one()

    pres_result = await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )
    pres = pres_result.scalar_one()

    provider = await resolve_llm(
        user, db,
        presentation_provider=pres.llm_provider,
        presentation_model=pres.llm_model,
    )

    system_prompt = build_planner_system_prompt(
        language=inp.language or "english",
        tone=inp.tone or "Client-Facing Professional",
    )
    user_prompt = build_planner_user_prompt(
        prompt=inp.prompt,
        data_summary=inp.raw_data_json,
        audience=inp.audience or "General",
        tone=inp.tone or "Professional",
        slide_count=inp.slide_count,
    )
    user_prompt += f"\n\nADDITIONAL INSTRUCTION FROM USER:\n{instruction}"

    model = pres.llm_model or getattr(provider, "default_model", "unknown")
    start = time.monotonic()
    plan_json = await provider.generate_with_retry(system_prompt, user_prompt, json_mode=True)
    latency = (time.monotonic() - start) * 1000

    if not _validate_plan(plan_json):
        raise ValueError("LLM returned invalid plan structure")

    new_plan = await _save_plan(presentation_id, plan_json, db)
    await _log_agent(
        presentation_id, provider.provider_name, model,
        system_prompt, user_prompt, plan_json, latency, db,
    )

    return {"id": str(new_plan.id), "version": new_plan.version, "plan_json": plan_json}
