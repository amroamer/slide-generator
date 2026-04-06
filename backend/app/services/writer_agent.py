import json
import logging
import time
import uuid

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_log import AgentLog
from app.models.presentation import Presentation, PresentationStatus
from app.models.presentation_input import PresentationInput
from app.models.presentation_plan import PresentationPlan
from app.models.slide import PresentationSlide
from app.models.user import User
from app.prompts.writer import (
    build_slide_refine_prompt,
    build_writer_system_prompt,
    build_writer_user_prompt,
)
from app.services import prompt_service
from app.services.llm_resolver import resolve_llm

logger = logging.getLogger(__name__)


def _generate_chart_from_table(data_table: dict | None) -> dict | None:
    """Fallback: auto-generate chart_data from a data_table if LLM didn't."""
    if not data_table or not data_table.get("headers") or not data_table.get("rows"):
        return None
    headers = data_table["headers"]
    rows = data_table["rows"]
    if len(headers) < 2 or len(rows) < 2:
        return None

    labels = [str(row[0]) for row in rows]
    datasets = []
    for col_idx in range(1, len(headers)):
        values = []
        is_numeric = True
        for row in rows:
            try:
                raw = str(row[col_idx] if col_idx < len(row) else "0")
                val = float(raw.replace(",", "").replace("%", "").replace("$", "").replace("SAR", "").strip())
                values.append(val)
            except (ValueError, IndexError):
                is_numeric = False
                break
        if is_numeric and values:
            datasets.append({"label": headers[col_idx], "values": values})

    if not datasets:
        return None

    if len(datasets) == 1 and len(labels) <= 6:
        chart_type = "donut"
    elif len(datasets) >= 2:
        chart_type = "bar"
    else:
        chart_type = "bar"

    return {"chart_type": chart_type, "labels": labels, "datasets": datasets}


async def _log_agent(
    presentation_id: uuid.UUID,
    provider_name: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    response_json: dict | list,
    latency_ms: float,
    db: AsyncSession,
):
    log = AgentLog(
        id=uuid.uuid4(),
        presentation_id=presentation_id,
        step="content",
        agent_name="Writer Agent",
        llm_provider=provider_name,
        llm_model=model,
        prompt_sent=f"SYSTEM:\n{system_prompt[:2000]}\n\nUSER:\n{user_prompt[:2000]}",
        response_received=json.dumps(response_json)[:10000],
        latency_ms=round(latency_ms, 1),
    )
    db.add(log)


async def generate_content(
    presentation_id: uuid.UUID, user: User, db: AsyncSession
) -> list[dict]:
    """Generate content for all slides using the Writer Agent."""
    # Load presentation
    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()

    # Load active plan
    plan_obj = (await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )).scalar_one()

    # Load input
    inp = (await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )).scalar_one()

    # Resolve LLM
    provider = await resolve_llm(
        user, db,
        presentation_provider=pres.llm_provider,
        presentation_model=pres.llm_model,
    )

    # Build prompts — try DB-configured first, fall back to hardcoded
    lang = inp.language or "english"
    tone = inp.tone or "Client-Facing Professional"
    audience = inp.audience or "General"

    modifier_keys = []
    tone_map = {
        "Formal Board-Level": "writer.system.tone.formal_board",
        "Client-Facing Professional": "writer.system.tone.client_facing",
        "Internal Working Session": "writer.system.tone.internal_working",
    }
    if tone in tone_map:
        modifier_keys.append(tone_map[tone])
    if lang == "arabic":
        modifier_keys.append("writer.system.lang.arabic")
    elif lang == "bilingual":
        modifier_keys.append("writer.system.lang.bilingual")

    db_system = await prompt_service.resolve_composed(
        "writer.system", modifier_keys, user.id, db, variables={"audience": audience}
    )
    system_prompt = db_system if db_system else build_writer_system_prompt(language=lang, tone=tone, audience=audience)

    # User prompt uses hardcoded builder (complex data formatting)
    user_prompt = build_writer_user_prompt(
        plan=plan_obj.plan_json,
        data_summary=inp.raw_data_json,
        original_prompt=inp.prompt,
    )

    model = pres.llm_model or getattr(provider, "default_model", "unknown")

    start = time.monotonic()
    result = await provider.generate_with_retry(
        system_prompt, user_prompt, json_mode=True
    )
    latency = (time.monotonic() - start) * 1000

    # Validate
    slides_data = result.get("slides", [])
    if not isinstance(slides_data, list) or len(slides_data) == 0:
        raise ValueError("Writer Agent returned no slides")

    # Build plan slide type map for chart validation
    plan_slide_types: dict[str, str] = {}
    for section in plan_obj.plan_json.get("sections", []):
        for sl in section.get("slides", []):
            plan_slide_types[sl["slide_id"]] = sl.get("slide_type", "content")

    # Check for chart slides missing chart_data
    missing_chart_ids = []
    for slide_content in slides_data:
        sid = slide_content.get("slide_id", "")
        plan_type = plan_slide_types.get(sid, "content")
        has_chart = bool(
            slide_content.get("chart_data")
            and slide_content["chart_data"].get("labels")
            and slide_content["chart_data"].get("datasets")
        )
        if "chart" in plan_type.lower() and not has_chart:
            missing_chart_ids.append(sid)

    # Targeted retry for missing chart_data
    if missing_chart_ids:
        logger.warning("Chart data missing for slides: %s — retrying", missing_chart_ids)
        data_preview = json.dumps(inp.raw_data_json)[:3000] if inp.raw_data_json else "No source data"
        retry_prompt = (
            f"The following slides are typed as 'chart' but you did not provide chart_data: {missing_chart_ids}.\n\n"
            f"Source data:\n{data_preview}\n\n"
            "Generate ONLY the chart_data for these slides. Return JSON:\n"
            '{"slides": [{"slide_id": "...", "chart_data": {"chart_type": "bar|line|pie|donut|area", '
            '"labels": [...], "datasets": [{"label": "...", "values": [...]}]}}]}\n\n'
            "Use real numeric values from the data. chart_type must be one of: bar, line, pie, donut, area."
        )
        try:
            retry_result = await provider.generate_with_retry(
                system_prompt, retry_prompt, json_mode=True
            )
            for retry_slide in retry_result.get("slides", []):
                rsid = retry_slide.get("slide_id")
                rcd = retry_slide.get("chart_data")
                if rsid and rcd and rcd.get("labels") and rcd.get("datasets"):
                    for orig in slides_data:
                        if orig.get("slide_id") == rsid:
                            orig["chart_data"] = rcd
                            missing_chart_ids = [x for x in missing_chart_ids if x != rsid]
                            break
        except Exception as e:
            logger.warning("Chart retry failed: %s", e)

    # Table-to-chart fallback for any still-missing chart slides
    for sid in missing_chart_ids:
        for slide_content in slides_data:
            if slide_content.get("slide_id") == sid:
                dt = slide_content.get("data_table")
                chart = _generate_chart_from_table(dt)
                if chart:
                    slide_content["chart_data"] = chart
                    logger.info("Generated chart from table for slide %s", sid)
                break

    # Delete existing slides for this presentation
    await db.execute(
        delete(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id
        )
    )

    # Build order map from plan
    order_counter = 0
    slide_section_map: dict[str, tuple[str, int]] = {}
    for section in plan_obj.plan_json.get("sections", []):
        section_title = section.get("section_title", "")
        for sl in section.get("slides", []):
            slide_section_map[sl["slide_id"]] = (section_title, order_counter)
            order_counter += 1

    # Create slide records
    saved_slides = []
    for slide_content in slides_data:
        sid = slide_content.get("slide_id", f"sl_{uuid.uuid4().hex[:8]}")
        section_title, order = slide_section_map.get(sid, ("", len(saved_slides)))

        slide = PresentationSlide(
            id=uuid.uuid4(),
            presentation_id=presentation_id,
            plan_id=plan_obj.id,
            slide_id=sid,
            section=section_title,
            order=order,
            title=slide_content.get("title", "Untitled"),
            content_json=slide_content,
        )
        db.add(slide)
        saved_slides.append(slide_content)

    # Log
    await _log_agent(
        presentation_id, provider.provider_name, model,
        system_prompt, user_prompt, result, latency, db,
    )

    # Advance status forward only
    if pres.status in (PresentationStatus.draft, PresentationStatus.input_complete, PresentationStatus.plan_complete):
        pres.status = PresentationStatus.content_complete
    await db.flush()

    return saved_slides


async def refine_slide_content(
    presentation_id: uuid.UUID,
    slide_id: str,
    instruction: str,
    user: User,
    db: AsyncSession,
) -> dict:
    """Refine a single slide's content via the Writer Agent."""
    # Load presentation
    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()

    # Load input for context
    inp = (await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )).scalar_one()

    # Load all slides to get context
    all_slides = (await db.execute(
        select(PresentationSlide)
        .where(PresentationSlide.presentation_id == presentation_id)
        .order_by(PresentationSlide.order)
    )).scalars().all()

    target = None
    prev_title = next_title = None
    for i, sl in enumerate(all_slides):
        if sl.slide_id == slide_id:
            target = sl
            if i > 0:
                prev_title = all_slides[i - 1].title
            if i < len(all_slides) - 1:
                next_title = all_slides[i + 1].title
            break

    if not target:
        raise ValueError(f"Slide {slide_id} not found")

    provider = await resolve_llm(
        user, db,
        presentation_provider=pres.llm_provider,
        presentation_model=pres.llm_model,
    )

    system_prompt = build_writer_system_prompt(
        language=inp.language or "english",
        tone=inp.tone or "Client-Facing Professional",
        audience=inp.audience or "General",
    )
    system_prompt += "\n\nYou are refining a single slide. Return ONLY the updated slide JSON."

    user_prompt = build_slide_refine_prompt(
        slide_content=target.content_json or {},
        user_instruction=instruction,
        prev_slide_title=prev_title,
        next_slide_title=next_title,
    )

    model = pres.llm_model or getattr(provider, "default_model", "unknown")
    start = time.monotonic()
    updated = await provider.generate_with_retry(
        system_prompt, user_prompt, json_mode=True
    )
    latency = (time.monotonic() - start) * 1000

    # Preserve slide_id
    updated["slide_id"] = slide_id

    # If instruction is chart-related and response has no chart_data, retry
    chart_keywords = {"chart", "generate chart", "chart_data", "visualization", "graph"}
    wants_chart = any(kw in instruction.lower() for kw in chart_keywords)
    has_chart = bool(
        updated.get("chart_data")
        and isinstance(updated["chart_data"], dict)
        and updated["chart_data"].get("labels")
        and updated["chart_data"].get("datasets")
    )
    if wants_chart and not has_chart:
        logger.warning("Refine response missing chart_data for chart instruction, retrying")
        data_preview = json.dumps(inp.raw_data_json)[:2000] if inp.raw_data_json else "No data"
        retry_prompt = (
            f"Current slide: {json.dumps(updated)}\n\n"
            f"Source data: {data_preview}\n\n"
            "You MUST include chart_data in your response. The chart_data field cannot be null.\n"
            "Create chart_data with chart_type (bar/line/pie/donut), labels array, and datasets array "
            "with real numeric values from the source data.\n"
            "Return the FULL updated slide JSON with chart_data included."
        )
        try:
            retry_result = await provider.generate_with_retry(
                system_prompt, retry_prompt, json_mode=True
            )
            retry_result["slide_id"] = slide_id
            rcd = retry_result.get("chart_data")
            if rcd and isinstance(rcd, dict) and rcd.get("labels") and rcd.get("datasets"):
                updated = retry_result
        except Exception as e:
            logger.warning("Chart retry failed: %s", e)

    # Update DB record
    target.title = updated.get("title", target.title)
    target.content_json = updated

    await _log_agent(
        presentation_id, provider.provider_name, model,
        system_prompt, user_prompt, updated, latency, db,
    )
    await db.flush()
    await db.refresh(target)

    return updated


async def regenerate_all_content(
    presentation_id: uuid.UUID,
    additional_instruction: str | None,
    user: User,
    db: AsyncSession,
) -> list[dict]:
    """Regenerate all content, optionally with additional instruction."""
    # Load input and patch prompt
    inp = (await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )).scalar_one()

    original_prompt = inp.prompt
    if additional_instruction:
        inp.prompt = f"{original_prompt}\n\nADDITIONAL INSTRUCTION: {additional_instruction}"

    try:
        result = await generate_content(presentation_id, user, db)
    finally:
        # Restore original prompt
        inp.prompt = original_prompt

    return result


async def generate_alternatives(
    presentation_id: uuid.UUID,
    slide_id: str,
    user: User,
    db: AsyncSession,
) -> list[dict]:
    """Generate 3 alternative content versions for a slide. Does NOT save to DB."""
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
        "You are the Writer Agent. Generate 3 alternative versions of the given slide. "
        "Return ONLY valid JSON."
    )
    user_prompt = (
        f"CURRENT SLIDE:\n{json.dumps(slide.content_json, indent=2)}\n\n"
        "Generate 3 alternatives with different approaches:\n"
        "Version A — Concise Executive: shorter, conclusion-first, max 3 bullets\n"
        "Version B — Data-Driven: specific numbers, metrics, percentages\n"
        "Version C — Narrative: storytelling approach, context and implications\n\n"
        'Return: {"alternatives": [{"version": "A", "label": "Concise Executive", '
        '"title": "...", "body": {"type": "bullets", "content": [...]}, '
        '"key_takeaway": "...", "speaker_notes": "..."}]}'
    )

    result = await provider.generate_with_retry(system_prompt, user_prompt, json_mode=True)

    alternatives = result.get("alternatives", [])
    # Preserve slide_id in each
    for alt in alternatives:
        alt["slide_id"] = slide_id

    return alternatives


# ── Slide-by-slide background generation ──────────────────────────────────────

import asyncio
from app.database import async_session_factory
from app.prompts.writer_single_slide import build_single_slide_system_prompt, build_single_slide_user_prompt
from app.services.task_manager import task_manager


def _extract_relevant_data(data_references: list, raw_data_json: dict | None) -> dict | None:
    """Extract data columns/rows relevant to one slide."""
    if not raw_data_json or not raw_data_json.get("files"):
        return None
    if not data_references:
        # Return summary of all files
        summary = {}
        for f in raw_data_json["files"]:
            fname = f.get("filename", "")
            if f.get("type") == "tabular":
                summary[fname] = {
                    "columns": f.get("columns", []),
                    "row_count": f.get("row_count", 0),
                    "sample_rows": (f.get("sample_rows") or [])[:5],
                }
            elif f.get("type") == "text":
                summary[fname] = {"text": f.get("text_content", "")[:300]}
        return summary if summary else None

    relevant = {}
    for ref in data_references:
        parts = ref.split(":")
        fname = parts[0]
        for f in raw_data_json["files"]:
            if f.get("filename") == fname:
                if f.get("type") == "tabular":
                    relevant[fname] = {
                        "columns": f.get("columns", []),
                        "sample_rows": (f.get("sample_rows") or [])[:10],
                        "stats": f.get("stats", {}),
                    }
                break
    return relevant if relevant else None


def _validate_slide_content(response: dict, slide_plan: dict) -> dict:
    """Validate and normalize single slide LLM response."""
    validated = {
        "slide_id": response.get("slide_id", slide_plan.get("slide_id")),
        "title": response.get("title", slide_plan.get("slide_title", "Untitled")),
        "body": response.get("body", {"type": "bullets", "content": []}),
        "key_takeaway": response.get("key_takeaway", ""),
        "speaker_notes": response.get("speaker_notes", ""),
        "chart_data": response.get("chart_data"),
        "data_table": response.get("data_table"),
    }
    if isinstance(validated["body"], list):
        validated["body"] = {"type": "bullets", "content": validated["body"]}
    if isinstance(validated["body"], str):
        validated["body"] = {"type": "paragraphs", "content": [validated["body"]]}
    if validated["chart_data"]:
        cd = validated["chart_data"]
        if not cd.get("labels") or not cd.get("datasets"):
            validated["chart_data"] = None
    return validated


async def start_content_generation(
    presentation_id: uuid.UUID, user: User, db: AsyncSession
) -> tuple[str, int]:
    """Start background slide-by-slide content generation. Returns (task_id, total_slides)."""
    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()

    plan_obj = (await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )).scalar_one()

    inp = (await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )).scalar_one()

    # Flatten slides from plan
    ordered_slides = []
    for section in plan_obj.plan_json.get("sections", []):
        for sl in section.get("slides", []):
            ordered_slides.append({
                "slide_plan": sl,
                "section_title": section.get("section_title", ""),
                "section_purpose": section.get("section_purpose", ""),
            })

    # Check which slides already have content (for resume)
    existing = (await db.execute(
        select(PresentationSlide.slide_id)
        .where(PresentationSlide.presentation_id == presentation_id)
        .where(PresentationSlide.content_json.isnot(None))
    )).scalars().all()
    existing_ids = set(existing)

    # Filter to only slides that need generation
    slides_to_gen = [s for s in ordered_slides if s["slide_plan"].get("slide_id") not in existing_ids]

    task_id = str(uuid.uuid4())
    total = len(slides_to_gen)
    if total == 0:
        total = len(ordered_slides)  # All exist, return total for UI

    await task_manager.create_task(task_id, total, "content_generation")

    # Serialize what the background task needs
    context = {
        "presentation_id": str(presentation_id),
        "user_id": str(user.id),
        "plan_id": str(plan_obj.id),
        "plan_version": plan_obj.version,
        "language": inp.language or "english",
        "tone": inp.tone or "Client-Facing Professional",
        "audience": inp.audience or "General",
        "prompt": inp.prompt,
        "raw_data_json": inp.raw_data_json,
        "llm_provider": pres.llm_provider,
        "llm_model": pres.llm_model,
        "ordered_slides": ordered_slides,
        "existing_ids": list(existing_ids),
    }

    # Launch background task
    asyncio.create_task(_generate_slides_background(task_id, context))

    return task_id, len(ordered_slides)


async def _generate_slides_background(task_id: str, ctx: dict):
    """Background coroutine that generates content one slide at a time."""
    from app.llm.factory import get_provider
    from app.config import settings as app_settings
    from app.models.llm_config import LLMConfig, decrypt_api_key

    logger.info("Background task %s starting for %s slides", task_id, len(ctx["ordered_slides"]))

    async with async_session_factory() as db:
        try:
            # Resolve LLM — must look up user's API keys from DB
            provider_name = ctx["llm_provider"] or app_settings.DEFAULT_LLM_PROVIDER
            model = ctx["llm_model"] or app_settings.DEFAULT_LLM_MODEL
            user_id = ctx["user_id"]

            api_key = None
            endpoint_url = None

            # Look up user's LLM config for API key
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
            logger.info("Background task %s: LLM provider resolved: %s/%s", task_id, provider_name, model)

            system_prompt = build_single_slide_system_prompt(
                ctx["language"], ctx["tone"], ctx["audience"]
            )

            existing_ids = set(ctx["existing_ids"])
            ordered = ctx["ordered_slides"]
            prev_summary = None

            for idx, slide_info in enumerate(ordered):
                slide_plan = slide_info["slide_plan"]
                slide_id = slide_plan.get("slide_id", f"sl_{idx}")
                slide_title = slide_plan.get("slide_title", f"Slide {idx + 1}")

                # Skip already-generated slides
                if slide_id in existing_ids:
                    prev_summary = {"title": slide_title, "key_takeaway": ""}
                    continue

                await task_manager.set_current_step(task_id, slide_id, slide_title)

                # Check cancellation
                progress = await task_manager.get_progress(task_id)
                if progress.get("status") == "cancelled":
                    break

                try:
                    source_data = _extract_relevant_data(
                        slide_plan.get("data_references", []),
                        ctx["raw_data_json"],
                    )

                    next_title = None
                    if idx + 1 < len(ordered):
                        next_title = ordered[idx + 1]["slide_plan"].get("slide_title")

                    user_prompt = build_single_slide_user_prompt(
                        slide_plan=slide_plan,
                        section_title=slide_info["section_title"],
                        section_purpose=slide_info["section_purpose"],
                        source_data=source_data,
                        prev_summary=prev_summary,
                        next_title=next_title,
                        original_prompt=ctx["prompt"],
                        slide_number=idx + 1,
                        total_slides=len(ordered),
                    )

                    start = time.monotonic()
                    response = await provider.generate(system_prompt, user_prompt, json_mode=True)
                    latency = (time.monotonic() - start) * 1000

                    validated = _validate_slide_content(response, slide_plan)

                    # Save to DB immediately
                    slide_record = PresentationSlide(
                        id=uuid.uuid4(),
                        presentation_id=uuid.UUID(ctx["presentation_id"]),
                        plan_id=uuid.UUID(ctx["plan_id"]),
                        slide_id=slide_id,
                        section=slide_info["section_title"],
                        order=idx,
                        title=validated.get("title", slide_title),
                        content_json=validated,
                    )
                    db.add(slide_record)

                    # Log
                    log = AgentLog(
                        id=uuid.uuid4(),
                        presentation_id=uuid.UUID(ctx["presentation_id"]),
                        step="content", agent_name="Writer Agent",
                        llm_provider=provider_name, llm_model=model,
                        prompt_sent=f"Single slide: {slide_id}",
                        response_received=json.dumps(validated)[:5000],
                        latency_ms=round(latency, 1),
                    )
                    db.add(log)
                    await db.commit()

                    await task_manager.update_progress(task_id, slide_id, slide_title, "completed")

                    prev_summary = {
                        "title": validated.get("title"),
                        "key_takeaway": validated.get("key_takeaway"),
                    }

                except Exception as e:
                    logger.exception("Failed to generate slide %s", slide_id)
                    await task_manager.update_progress(task_id, slide_id, str(e), "failed")
                    prev_summary = {"title": slide_title, "key_takeaway": ""}
                    continue

            # Update presentation status
            pres = (await db.execute(
                select(Presentation).where(Presentation.id == uuid.UUID(ctx["presentation_id"]))
            )).scalar_one()
            if pres.status in (PresentationStatus.draft, PresentationStatus.input_complete, PresentationStatus.plan_complete):
                pres.status = PresentationStatus.content_complete
            await db.commit()

        except Exception as e:
            logger.exception("Background generation task FATAL: %s", e)
            # Mark task as error in Redis so frontend knows
            try:
                r = await task_manager._get_redis()
                raw = await r.get(f"task:{task_id}")
                if raw:
                    task = json.loads(raw)
                    task["status"] = "error"
                    task["error_message"] = str(e)[:500]
                    await r.set(f"task:{task_id}", json.dumps(task), ex=3600)
            except Exception:
                pass
