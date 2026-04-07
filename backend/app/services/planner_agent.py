import asyncio
import json
import logging
import time
import uuid

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.agent_log import AgentLog
from app.models.presentation import Presentation, PresentationStatus
from app.models.presentation_input import PresentationInput
from app.models.presentation_plan import PresentationPlan
from app.models.user import User
from app.prompts.planner import (
    build_planner_system_prompt,
    build_planner_user_prompt,
    build_structure_system_prompt,
    build_structure_user_prompt,
    build_section_detail_system_prompt,
    build_section_detail_user_prompt,
)
from app.services.llm_resolver import resolve_llm
from app.services.task_manager import task_manager
from app.services import prompt_service
from app.database import async_session_factory

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
        parsed_data_text=inp.parsed_data_text,
    )

    logger.info("Planner user prompt length: %d chars (parsed_data_text: %s)",
                len(user_prompt), "yes" if inp.parsed_data_text else "no")

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


def _validate_structure(structure: dict) -> bool:
    """Validate Phase 1 structure response."""
    if not isinstance(structure, dict):
        return False
    sections = structure.get("sections")
    if not isinstance(sections, list) or len(sections) == 0:
        return False
    for s in sections:
        if not isinstance(s, dict):
            return False
        if not s.get("section_title") or not s.get("slide_count"):
            return False
    return True


def _validate_section_slides(response: dict, expected_count: int) -> bool:
    """Validate Phase 2 section detail response."""
    if not isinstance(response, dict):
        return False
    slides = response.get("slides")
    if not isinstance(slides, list) or len(slides) == 0:
        return False
    return True


def _build_data_context(data_summary: dict | None, parsed_data_text: str | None = None) -> str:
    """Build a data context string for section detail prompts.

    Prefers parsed_data_text (human-readable with actual cell values)
    over raw_data_json (column names and stats only).
    """
    if parsed_data_text:
        logger.info("Data context length: %d chars (from parsed_data_text)", len(parsed_data_text))
        return parsed_data_text

    if not data_summary or not data_summary.get("files"):
        return ""
    parts = []
    for f in data_summary["files"]:
        fname = f.get("filename", "unknown")
        ftype = f.get("type", "unknown")
        if ftype == "tabular":
            if "sheets" in f:
                for sheet in f["sheets"]:
                    cols = sheet.get("columns", [])
                    rows = sheet.get("row_count", 0)
                    stats = sheet.get("stats", {})
                    sample_rows = sheet.get("sample_rows", [])
                    parts.append(
                        f"  - {fname} (sheet: {sheet.get('sheet_name', '?')}): "
                        f"{rows} rows, columns: {cols}"
                    )
                    # Include actual sample rows
                    if sample_rows:
                        parts.append(f"  Sample data ({min(len(sample_rows), 30)} rows):")
                        for row in sample_rows[:30]:
                            row_parts = [f"{k}: {v}" for k, v in row.items() if v not in (None, "", "nan")]
                            if row_parts:
                                parts.append(f"    {' | '.join(row_parts)}")
                    for col, st in stats.items():
                        if st.get("type") == "numeric":
                            parts.append(
                                f"    {col}: min={st.get('min')}, max={st.get('max')}, "
                                f"mean={st.get('mean')}, count={st.get('count')}"
                            )
                        else:
                            parts.append(
                                f"    {col}: {st.get('unique')} unique values, "
                                f"count={st.get('count')}"
                            )
            else:
                cols = f.get("columns", [])
                rows = f.get("row_count", 0)
                stats = f.get("stats", {})
                sample_rows = f.get("sample_rows", [])
                parts.append(f"  - {fname}: {rows} rows, columns: {cols}")
                # Include actual sample rows
                if sample_rows:
                    parts.append(f"  Sample data ({min(len(sample_rows), 30)} rows):")
                    for row in sample_rows[:30]:
                        row_parts = [f"{k}: {v}" for k, v in row.items() if v not in (None, "", "nan")]
                        if row_parts:
                            parts.append(f"    {' | '.join(row_parts)}")
                for col, st in stats.items():
                    if st.get("type") == "numeric":
                        parts.append(
                            f"    {col}: min={st.get('min')}, max={st.get('max')}, "
                            f"mean={st.get('mean')}, count={st.get('count')}"
                        )
                    else:
                        parts.append(
                            f"    {col}: {st.get('unique')} unique values, "
                            f"count={st.get('count')}"
                        )
        elif ftype == "text":
            chars = f.get("char_count", 0)
            pages = f.get("page_count")
            desc = f"  - {fname}: {chars} characters"
            if pages:
                desc += f", {pages} pages"
            parts.append(desc)
            text_preview = f.get("text_content", "")[:2000]
            if text_preview:
                parts.append(f"    {text_preview}")
        elif ftype == "structured":
            parts.append(f"  - {fname}: structured JSON data")
            data_str = json.dumps(f.get("data", {}))[:2000]
            parts.append(f"    {data_str}")
    result = "\n".join(parts)
    logger.info("Data context length: %d chars (from raw_data_json fallback)", len(result))
    return result


async def start_progressive_plan(
    presentation_id: uuid.UUID, user: User, db: AsyncSession
) -> tuple[str, int]:
    """Start progressive plan generation. Returns (task_id, 0) immediately.
    The total section count is determined after Phase 1 completes.
    """
    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()

    inp = (await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )).scalar_one()

    task_id = str(uuid.uuid4())

    # Create task with 1 step initially (structure generation)
    # We'll update the total once structure is known
    await task_manager.create_task(task_id, 1, "plan_generation")

    context = {
        "presentation_id": str(presentation_id),
        "user_id": str(user.id),
        "language": inp.language or "english",
        "tone": inp.tone or "Client-Facing Professional",
        "audience": inp.audience or "General",
        "prompt": inp.prompt,
        "raw_data_json": inp.raw_data_json,
        "parsed_data_text": inp.parsed_data_text,
        "slide_count": inp.slide_count,
        "llm_provider": pres.llm_provider,
        "llm_model": pres.llm_model,
    }

    asyncio.create_task(_generate_plan_progressive(task_id, context))

    return task_id, 0


async def _generate_plan_progressive(task_id: str, ctx: dict):
    """Background coroutine: Phase 1 generates structure, Phase 2 fills in each section."""
    from app.llm.factory import get_provider
    from app.config import settings as app_settings
    from app.models.llm_config import LLMConfig, decrypt_api_key

    logger.info("Progressive plan task %s starting", task_id)

    async with async_session_factory() as db:
        try:
            # Resolve LLM provider
            provider_name = ctx["llm_provider"] or app_settings.DEFAULT_LLM_PROVIDER
            model = ctx["llm_model"] or app_settings.DEFAULT_LLM_MODEL
            user_id = ctx["user_id"]
            presentation_id = uuid.UUID(ctx["presentation_id"])

            api_key = None
            endpoint_url = None
            if user_id:
                cfg_result = await db.execute(
                    select(LLMConfig).where(
                        LLMConfig.user_id == uuid.UUID(user_id),
                        LLMConfig.provider == provider_name,
                    )
                )
                user_cfg = cfg_result.scalar_one_or_none()
                if user_cfg:
                    if user_cfg.api_key_encrypted:
                        try:
                            api_key = decrypt_api_key(user_cfg.api_key_encrypted)
                        except Exception:
                            pass
                    if user_cfg.endpoint_url:
                        endpoint_url = user_cfg.endpoint_url

            provider = get_provider(
                provider_name=provider_name,
                api_key=api_key,
                endpoint_url=endpoint_url,
                model=model,
            )
            # Inject anti-hallucination rules
            from app.services.llm_resolver import _load_anti_hallucination
            rules = await _load_anti_hallucination(db)
            if rules:
                provider.set_system_suffix(rules)
            logger.info("Progressive plan task %s: LLM resolved %s/%s", task_id, provider_name, model)

            lang = ctx["language"]
            tone = ctx["tone"]

            # ──────── PHASE 1: Generate structure ────────
            await task_manager.set_current_step(task_id, "structure", "Generating presentation structure")

            structure_system = build_structure_system_prompt(lang, tone)
            structure_user = build_structure_user_prompt(
                prompt=ctx["prompt"],
                data_summary=ctx["raw_data_json"],
                audience=ctx["audience"],
                tone=tone,
                slide_count=ctx["slide_count"],
                parsed_data_text=ctx.get("parsed_data_text"),
            )

            start = time.monotonic()
            structure = await provider.generate_with_retry(
                structure_system, structure_user, json_mode=True
            )
            structure_latency = (time.monotonic() - start) * 1000

            if not _validate_structure(structure):
                # Retry once with stricter prompt
                start2 = time.monotonic()
                structure = await provider.generate(
                    structure_system,
                    structure_user + "\n\nCRITICAL: Return JSON with 'title' and 'sections' array. Each section needs 'section_id', 'section_title', 'section_purpose', 'slide_count', 'slide_types'.",
                    json_mode=True,
                )
                structure_latency += (time.monotonic() - start2) * 1000
                if not _validate_structure(structure):
                    raise ValueError("LLM returned invalid structure after retries")

            # Log the structure call
            log = AgentLog(
                id=uuid.uuid4(),
                presentation_id=presentation_id,
                step="plan",
                agent_name="Planner Agent (structure)",
                llm_provider=provider_name,
                llm_model=model,
                prompt_sent=f"SYSTEM:\n{structure_system}\n\nUSER:\n{structure_user}",
                response_received=json.dumps(structure)[:10000],
                reasoning=None,
                latency_ms=round(structure_latency, 1),
            )
            db.add(log)

            sections = structure["sections"]
            title = structure.get("title", "Untitled Presentation")
            total_sections = len(sections)

            # Ensure section_ids exist
            for i, sec in enumerate(sections):
                if not sec.get("section_id"):
                    sec["section_id"] = f"s{i + 1}"

            # Build the initial plan skeleton with empty slides
            plan_json = {
                "title": title,
                "sections": [],
            }
            for sec in sections:
                plan_json["sections"].append({
                    "section_id": sec["section_id"],
                    "section_title": sec["section_title"],
                    "section_purpose": sec.get("section_purpose", ""),
                    "slides": [],  # Empty — will be filled by Phase 2
                    "_status": "pending",
                    "_slide_count": sec.get("slide_count", 2),
                    "_slide_types": sec.get("slide_types", ["content"]),
                })

            # Save initial skeleton to DB
            await _deactivate_plans(presentation_id, db)
            version = await _get_next_version(presentation_id, db)
            plan_record = PresentationPlan(
                id=uuid.uuid4(),
                presentation_id=presentation_id,
                version=version,
                plan_json=plan_json,
                is_active=True,
            )
            db.add(plan_record)
            await db.flush()
            await db.commit()

            # Update task: now we know the total sections
            # We set total = total_sections (one step per section)
            r = await task_manager._get_redis()
            raw = await r.get(f"task:{task_id}")
            if raw:
                task_data = json.loads(raw)
                task_data["total"] = total_sections
                task_data["completed"] = 0
                task_data["status"] = "running"
                task_data["plan_id"] = str(plan_record.id)
                task_data["structure"] = {
                    "title": title,
                    "sections": [
                        {
                            "section_id": s["section_id"],
                            "section_title": s["section_title"],
                            "section_purpose": s.get("section_purpose", ""),
                            "slide_count": s.get("slide_count", 2),
                            "slide_types": s.get("slide_types", ["content"]),
                        }
                        for s in sections
                    ],
                }
                await r.set(f"task:{task_id}", json.dumps(task_data), ex=3600)

            logger.info("Progressive plan task %s: structure done, %d sections", task_id, total_sections)

            # ──────── PHASE 2: Generate each section's details ────────
            data_context = _build_data_context(ctx["raw_data_json"], ctx.get("parsed_data_text"))
            next_slide_id = 1

            for sec_idx, sec in enumerate(sections):
                section_id = sec["section_id"]
                section_title = sec["section_title"]
                section_purpose = sec.get("section_purpose", "")
                slide_count = sec.get("slide_count", 2)
                slide_types = sec.get("slide_types", ["content"] * slide_count)

                # Check cancellation
                progress = await task_manager.get_progress(task_id)
                if progress.get("status") == "cancelled":
                    logger.info("Progressive plan task %s cancelled at section %d", task_id, sec_idx + 1)
                    # Mark remaining sections as cancelled in plan
                    for remaining_idx in range(sec_idx, total_sections):
                        plan_json["sections"][remaining_idx]["_status"] = "cancelled"
                    plan_record.plan_json = plan_json
                    flag_modified(plan_record, "plan_json")
                    await db.flush()
                    await db.commit()
                    break

                await task_manager.set_current_step(
                    task_id, section_id,
                    f"Generating slides for \"{section_title}\""
                )

                # Update plan section status to generating
                plan_json["sections"][sec_idx]["_status"] = "generating"
                plan_record.plan_json = plan_json
                flag_modified(plan_record, "plan_json")
                await db.flush()
                await db.commit()

                # Build context summaries
                prev_summaries = []
                for prev_sec in sections[:sec_idx]:
                    prev_summaries.append(
                        f"  - {prev_sec['section_title']}: {prev_sec.get('section_purpose', '')}"
                    )
                previous_sections_summary = "\n".join(prev_summaries) if prev_summaries else "None (this is the first section)"

                upcoming_summaries = []
                for up_sec in sections[sec_idx + 1:]:
                    upcoming_summaries.append(
                        f"  - {up_sec['section_title']}: {up_sec.get('section_purpose', '')}"
                    )
                upcoming_sections_summary = "\n".join(upcoming_summaries) if upcoming_summaries else "None (this is the last section)"

                section_system = build_section_detail_system_prompt(lang, tone)
                section_user = build_section_detail_user_prompt(
                    presentation_title=title,
                    section_number=sec_idx + 1,
                    total_sections=total_sections,
                    section_title=section_title,
                    section_purpose=section_purpose,
                    slide_count=slide_count,
                    slide_types=slide_types,
                    previous_sections_summary=previous_sections_summary,
                    upcoming_sections_summary=upcoming_sections_summary,
                    data_context=data_context,
                    next_slide_id_start=next_slide_id,
                )

                try:
                    start = time.monotonic()
                    section_response = await provider.generate_with_retry(
                        section_system, section_user, json_mode=True
                    )
                    section_latency = (time.monotonic() - start) * 1000

                    if not _validate_section_slides(section_response, slide_count):
                        raise ValueError(f"Invalid slides for section {section_id}")

                    slides = section_response.get("slides", [])

                    # Ensure slide_ids
                    for si, sl in enumerate(slides):
                        if not sl.get("slide_id"):
                            sl["slide_id"] = f"sl{next_slide_id + si}"

                    # Update plan with completed section
                    plan_json["sections"][sec_idx]["slides"] = slides
                    plan_json["sections"][sec_idx]["_status"] = "complete"
                    plan_record.plan_json = plan_json
                    flag_modified(plan_record, "plan_json")
                    await db.flush()
                    await db.commit()

                    # Log this section call
                    log = AgentLog(
                        id=uuid.uuid4(),
                        presentation_id=presentation_id,
                        step="plan",
                        agent_name=f"Planner Agent (section {sec_idx + 1})",
                        llm_provider=provider_name,
                        llm_model=model,
                        prompt_sent=f"SYSTEM:\n{section_system}\n\nUSER:\n{section_user}",
                        response_received=json.dumps(section_response)[:10000],
                        reasoning=None,
                        latency_ms=round(section_latency, 1),
                    )
                    db.add(log)
                    await db.flush()
                    await db.commit()

                    await task_manager.update_progress(
                        task_id, section_id, section_title, "completed"
                    )
                    logger.info(
                        "Progressive plan task %s: section %d/%d done (%s)",
                        task_id, sec_idx + 1, total_sections, section_title,
                    )

                except Exception as e:
                    logger.error(
                        "Progressive plan task %s: section %d failed: %s",
                        task_id, sec_idx + 1, str(e),
                    )
                    plan_json["sections"][sec_idx]["_status"] = "failed"
                    plan_json["sections"][sec_idx]["_error"] = str(e)
                    plan_record.plan_json = plan_json
                    flag_modified(plan_record, "plan_json")
                    await db.flush()
                    await db.commit()

                    await task_manager.update_progress(
                        task_id, section_id, str(e), "failed"
                    )

                next_slide_id += slide_count

            # ──────── FINALIZE ────────
            # Clean up internal status fields from the final plan
            final_plan = json.loads(json.dumps(plan_json))  # deep copy
            for sec in final_plan["sections"]:
                sec.pop("_status", None)
                sec.pop("_slide_count", None)
                sec.pop("_slide_types", None)
                sec.pop("_error", None)

            plan_record.plan_json = final_plan
            flag_modified(plan_record, "plan_json")
            await db.flush()

            # Advance presentation status
            pres = (await db.execute(
                select(Presentation).where(Presentation.id == presentation_id)
            )).scalar_one()
            if pres.status in (PresentationStatus.draft, PresentationStatus.input_complete):
                pres.status = PresentationStatus.plan_complete
            await db.flush()
            await db.commit()

            logger.info("Progressive plan task %s completed", task_id)

        except Exception as e:
            logger.error("Progressive plan task %s fatal error: %s", task_id, str(e))
            # Update task to error state
            r = await task_manager._get_redis()
            raw = await r.get(f"task:{task_id}")
            if raw:
                task_data = json.loads(raw)
                task_data["status"] = "error"
                task_data["error_message"] = str(e)
                await r.set(f"task:{task_id}", json.dumps(task_data), ex=3600)
            try:
                await db.rollback()
            except Exception:
                pass


async def retry_section(
    presentation_id: uuid.UUID,
    section_id: str,
    user: User,
    db: AsyncSession,
) -> dict:
    """Retry generating a single failed section's details."""
    plan_result = await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )
    plan_record = plan_result.scalar_one()
    plan_json = plan_record.plan_json

    # Find the target section
    target_idx = None
    target_sec = None
    sections = plan_json.get("sections", [])
    for idx, sec in enumerate(sections):
        if sec.get("section_id") == section_id:
            target_idx = idx
            target_sec = sec
            break

    if target_sec is None:
        raise ValueError(f"Section {section_id} not found in plan")

    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()
    inp = (await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )).scalar_one()

    provider = await resolve_llm(
        user, db,
        presentation_provider=pres.llm_provider,
        presentation_model=pres.llm_model,
    )

    lang = inp.language or "english"
    tone = inp.tone or "Client-Facing Professional"
    title = plan_json.get("title", "Untitled")
    total_sections = len(sections)

    # Calculate slide_id start
    next_slide_id = 1
    for sec in sections[:target_idx]:
        next_slide_id += sec.get("_slide_count", len(sec.get("slides", []))) or 2

    slide_count = target_sec.get("_slide_count", 2)
    slide_types = target_sec.get("_slide_types", ["content"] * slide_count)

    data_context = _build_data_context(inp.raw_data_json)

    prev_summaries = []
    for prev_sec in sections[:target_idx]:
        prev_summaries.append(
            f"  - {prev_sec['section_title']}: {prev_sec.get('section_purpose', '')}"
        )

    upcoming_summaries = []
    for up_sec in sections[target_idx + 1:]:
        upcoming_summaries.append(
            f"  - {up_sec['section_title']}: {up_sec.get('section_purpose', '')}"
        )

    section_system = build_section_detail_system_prompt(lang, tone)
    section_user = build_section_detail_user_prompt(
        presentation_title=title,
        section_number=target_idx + 1,
        total_sections=total_sections,
        section_title=target_sec["section_title"],
        section_purpose=target_sec.get("section_purpose", ""),
        slide_count=slide_count,
        slide_types=slide_types,
        previous_sections_summary="\n".join(prev_summaries) if prev_summaries else "None",
        upcoming_sections_summary="\n".join(upcoming_summaries) if upcoming_summaries else "None",
        data_context=data_context,
        next_slide_id_start=next_slide_id,
    )

    model = pres.llm_model or getattr(provider, "default_model", "unknown")
    start = time.monotonic()
    section_response = await provider.generate_with_retry(
        section_system, section_user, json_mode=True
    )
    latency = (time.monotonic() - start) * 1000

    if not _validate_section_slides(section_response, slide_count):
        raise ValueError("LLM returned invalid section slides")

    slides = section_response.get("slides", [])
    for si, sl in enumerate(slides):
        if not sl.get("slide_id"):
            sl["slide_id"] = f"sl{next_slide_id + si}"

    # Update the section in plan
    plan_json["sections"][target_idx]["slides"] = slides
    plan_json["sections"][target_idx].pop("_status", None)
    plan_json["sections"][target_idx].pop("_error", None)
    plan_json["sections"][target_idx].pop("_slide_count", None)
    plan_json["sections"][target_idx].pop("_slide_types", None)

    plan_record.plan_json = plan_json
    await db.flush()

    await _log_agent(
        presentation_id, provider.provider_name, model,
        section_system, section_user, section_response, latency, db,
    )

    return {"id": str(plan_record.id), "version": plan_record.version, "plan_json": plan_json}


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
