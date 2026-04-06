"""Central pipeline state management — tracks data flow and staleness across the 5-step pipeline."""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.presentation import Presentation
from app.models.presentation_input import PresentationInput
from app.models.presentation_plan import PresentationPlan
from app.models.slide import PresentationSlide

logger = logging.getLogger(__name__)


def _hash_data(*args) -> str:
    """Create a stable hash of data for change detection."""
    raw = json.dumps(args, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _ts(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


async def get_pipeline_status(presentation_id: uuid.UUID, db: AsyncSession) -> dict:
    """Returns full pipeline state for a presentation."""
    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one_or_none()
    if not pres:
        return {"error": "not_found"}

    inp = (await db.execute(
        select(PresentationInput).where(PresentationInput.presentation_id == presentation_id)
    )).scalar_one_or_none()

    plan = (await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()

    slides_result = await db.execute(
        select(PresentationSlide)
        .where(PresentationSlide.presentation_id == presentation_id)
        .order_by(PresentationSlide.order)
    )
    slides = slides_result.scalars().all()

    now = datetime.now(timezone.utc)

    # Step 1: Input
    input_modified = pres.input_modified_at
    has_input = inp is not None

    # Step 2: Plan
    plan_stale = False
    plan_stale_reason = None
    has_plan = plan is not None
    if has_plan and input_modified:
        if plan.created_at.replace(tzinfo=timezone.utc) < input_modified.replace(tzinfo=timezone.utc):
            plan_stale = True
            plan_stale_reason = "Input data changed since plan was generated"

    # Step 3: Content
    content_stale = False
    content_stale_reason = None
    has_content = any(s.content_json for s in slides)
    if has_content and has_plan:
        plan_modified = pres.plan_modified_at
        content_modified = pres.content_modified_at
        if plan_modified and content_modified:
            if content_modified < plan_modified:
                content_stale = True
                content_stale_reason = "Plan was modified since content was generated"
        if plan_stale:
            content_stale = True
            content_stale_reason = "Input data changed — plan and content need regeneration"

    # Check slide count mismatch with plan
    plan_slide_ids = set()
    if has_plan:
        for sec in plan.plan_json.get("sections", []):
            for sl in sec.get("slides", []):
                plan_slide_ids.add(sl.get("slide_id"))
    content_slide_ids = {s.slide_id for s in slides}
    missing_slides = plan_slide_ids - content_slide_ids
    orphaned_slides = content_slide_ids - plan_slide_ids if plan_slide_ids else set()

    # Step 4: Design
    design_stale = False
    design_stale_reason = None
    has_design = any(s.layout for s in slides)
    if has_design:
        if content_stale:
            design_stale = True
            design_stale_reason = "Content changed — designs need updating"
        elif pres.content_modified_at and pres.design_modified_at:
            if pres.design_modified_at < pres.content_modified_at:
                design_stale = True
                design_stale_reason = "Content was edited after designs were applied"

    # Step 5: Export
    export_stale = False
    export_stale_reason = None
    has_export = pres.last_exported_at is not None
    if has_export:
        changed_steps = []
        if pres.content_modified_at and pres.last_exported_at < pres.content_modified_at:
            changed_steps.append("Content")
        if pres.plan_modified_at and pres.last_exported_at < pres.plan_modified_at:
            changed_steps.append("Plan")
        if pres.design_modified_at and pres.last_exported_at < pres.design_modified_at:
            changed_steps.append("Design")
        if changed_steps:
            export_stale = True
            export_stale_reason = f"Changes in: {', '.join(changed_steps)}"

    def step_status(has_data: bool, is_stale: bool) -> str:
        if not has_data:
            return "not_started"
        return "stale" if is_stale else "completed"

    steps = {
        "input": {
            "status": "completed" if has_input else "not_started",
            "last_modified": _ts(input_modified),
            "stale_reason": None,
        },
        "plan": {
            "status": step_status(has_plan, plan_stale),
            "last_modified": _ts(plan.created_at) if plan else None,
            "version": plan.version if plan else 0,
            "stale_reason": plan_stale_reason,
        },
        "content": {
            "status": step_status(has_content, content_stale),
            "last_modified": _ts(pres.content_modified_at),
            "slide_count": len(slides),
            "stale_reason": content_stale_reason,
            "missing_slides": list(missing_slides),
            "orphaned_slides": list(orphaned_slides),
        },
        "design": {
            "status": step_status(has_design, design_stale),
            "last_modified": _ts(pres.design_modified_at),
            "stale_reason": design_stale_reason,
        },
        "export": {
            "status": step_status(has_export, export_stale),
            "last_exported": _ts(pres.last_exported_at),
            "stale_reason": export_stale_reason,
        },
    }

    # Determine furthest completed step
    step_order = ["input", "plan", "content", "design", "export"]
    current_step = 1
    for i, name in enumerate(step_order):
        if steps[name]["status"] in ("completed", "stale"):
            current_step = i + 2  # next step
    current_step = min(current_step, 5)

    return {
        "current_step": current_step,
        "steps": steps,
        "has_stale_steps": any(s["status"] == "stale" for s in steps.values()),
        "has_input": has_input,
        "has_plan": has_plan,
        "has_content": has_content,
        "has_design": has_design,
        "has_export": has_export,
    }


async def record_step_change(
    presentation_id: uuid.UUID, step: str, db: AsyncSession
):
    """Called after any mutation. Updates the timestamp for the given step."""
    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()

    now = datetime.now(timezone.utc)

    if step == "input":
        pres.input_modified_at = now
    elif step == "plan":
        pres.plan_modified_at = now
    elif step == "content":
        pres.content_modified_at = now
    elif step == "design":
        pres.design_modified_at = now
    elif step == "export":
        pres.last_exported_at = now

    # Don't flush here — caller will flush
