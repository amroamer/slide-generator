import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.presentation import Presentation, PresentationStatus
from app.models.user import User
from app.schemas.presentation import (
    PresentationCreate,
    PresentationListResponse,
    PresentationResponse,
    PresentationUpdate,
)
from app.services.auth_service import get_current_user
from app.services.pipeline_manager import get_pipeline_status

router = APIRouter(prefix="/api/presentations", tags=["presentations"])


def _not_deleted():
    """Filter clause excluding soft-deleted presentations."""
    return Presentation.deleted_at.is_(None)


def _owned_by(user: User):
    """Filter clause for user ownership."""
    return Presentation.user_id == user.id


async def _get_presentation(
    presentation_id: uuid.UUID, user: User, db: AsyncSession
) -> Presentation:
    """Fetch a presentation owned by user, or raise 404."""
    result = await db.execute(
        select(Presentation).where(
            Presentation.id == presentation_id,
            _owned_by(user),
            _not_deleted(),
        )
    )
    pres = result.scalar_one_or_none()
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return pres


@router.get("")
async def list_presentations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    status: str | None = Query(None),
    sort_by: str = Query("updated_at"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List current user's presentations, paginated."""
    base = select(Presentation).where(_owned_by(current_user), _not_deleted())

    if search:
        base = base.where(Presentation.title.ilike(f"%{search}%"))

    if status:
        try:
            status_enum = PresentationStatus(status)
            base = base.where(Presentation.status == status_enum)
        except ValueError:
            pass  # ignore invalid status filter

    # Count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Sort
    if sort_by == "created_at":
        base = base.order_by(Presentation.created_at.desc())
    else:
        base = base.order_by(Presentation.updated_at.desc())

    # Paginate
    offset = (page - 1) * page_size
    result = await db.execute(base.offset(offset).limit(page_size))
    items = result.scalars().all()

    # Enrich items with thumbnail preview data
    from app.models.presentation_input import PresentationInput
    from app.models.presentation_plan import PresentationPlan
    from app.models.slide import PresentationSlide

    pres_ids = [p.id for p in items]
    enriched = []

    # Batch-load inputs, plans, first slides for all presentations
    inputs_map: dict[uuid.UUID, PresentationInput] = {}
    if pres_ids:
        inp_result = await db.execute(
            select(PresentationInput).where(PresentationInput.presentation_id.in_(pres_ids))
        )
        for inp in inp_result.scalars().all():
            inputs_map[inp.presentation_id] = inp

    plans_map: dict[uuid.UUID, dict] = {}
    if pres_ids:
        plan_result = await db.execute(
            select(PresentationPlan).where(
                PresentationPlan.presentation_id.in_(pres_ids),
                PresentationPlan.is_active == True,  # noqa: E712
            )
        )
        for plan in plan_result.scalars().all():
            pj = plan.plan_json or {}
            sections = pj.get("sections", [])
            slide_count = sum(len(s.get("slides", [])) for s in sections)
            plans_map[plan.presentation_id] = {
                "section_count": len(sections),
                "planned_slide_count": slide_count,
                "section_titles": [s.get("section_title", "") for s in sections[:5]],
            }

    slides_map: dict[uuid.UUID, dict] = {}
    if pres_ids:
        # Get first slide per presentation (order=0)
        for pid in pres_ids:
            sl_result = await db.execute(
                select(PresentationSlide)
                .where(PresentationSlide.presentation_id == pid)
                .order_by(PresentationSlide.order)
                .limit(1)
            )
            first_slide = sl_result.scalar_one_or_none()
            if first_slide and first_slide.content_json:
                cj = first_slide.content_json
                body = cj.get("body", {})
                bullets = []
                if isinstance(body, dict):
                    bullets = body.get("content", [])[:3]
                elif isinstance(body, list):
                    bullets = body[:3]
                bullets = [str(b)[:80] for b in bullets if isinstance(b, str)]
                slides_map[pid] = {
                    "first_slide_title": first_slide.title or cj.get("title", ""),
                    "first_slide_bullets": bullets,
                    "first_slide_type": first_slide.layout or "title_bullets",
                    "has_chart": bool(cj.get("chart_data")),
                    "has_table": bool(cj.get("data_table") and isinstance(cj.get("data_table"), dict) and cj["data_table"].get("headers")),
                }

    for p in items:
        resp = PresentationResponse.model_validate(p)
        d = resp.model_dump()
        inp = inputs_map.get(p.id)
        d["prompt_excerpt"] = (inp.prompt[:80] if inp and inp.prompt else "") if inp else ""
        plan = plans_map.get(p.id)
        d["section_count"] = plan["section_count"] if plan else 0
        d["section_titles"] = plan["section_titles"] if plan else []
        sl = slides_map.get(p.id)
        d["first_slide_title"] = sl["first_slide_title"] if sl else ""
        d["first_slide_bullets"] = sl["first_slide_bullets"] if sl else []
        d["first_slide_type"] = sl["first_slide_type"] if sl else ""
        d["has_chart"] = sl["has_chart"] if sl else False
        d["has_table"] = sl["has_table"] if sl else False
        enriched.append(d)

    return {
        "items": enriched,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", response_model=PresentationResponse, status_code=201)
async def create_presentation(
    body: PresentationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new presentation."""
    pres = Presentation(
        id=uuid.uuid4(),
        user_id=current_user.id,
        title=body.title,
    )
    db.add(pres)
    await db.flush()
    await db.refresh(pres)
    return pres


from pydantic import BaseModel as _PydanticBase


class EnhancePromptRequest(_PydanticBase):
    prompt: str
    action: str


ENHANCE_INSTRUCTIONS: dict[str, str] = {
    "specific": "Take this presentation prompt and make it more specific by adding details about what data to highlight, what comparisons to make, and what recommendations to include:\n\n{prompt}",
    "data": "Enhance this prompt to emphasize data analysis, KPIs, and metrics:\n\n{prompt}",
    "executive": "Rewrite this prompt for a board-level executive audience, emphasizing strategic decisions and business impact:\n\n{prompt}",
    "structure": "Enhance this prompt by suggesting specific sections like Executive Summary, Risk Analysis, Financial Overview, Recommendations:\n\n{prompt}",
    "simplify": "Simplify this presentation prompt to be clear and concise:\n\n{prompt}",
}


@router.post("/enhance-prompt")
async def enhance_prompt(
    body: EnhancePromptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enhance a presentation prompt using the configured LLM."""
    from app.services.llm_resolver import resolve_llm

    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is empty")

    template = ENHANCE_INSTRUCTIONS.get(body.action)
    if not template:
        raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")

    try:
        provider = await resolve_llm(current_user, db)
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"No LLM configured. Set up an AI model in Settings → LLM Configuration. ({e})")

    system = "You are a presentation prompt enhancer. Improve the user's prompt based on the instruction. Return ONLY the improved prompt text, nothing else. Do not add greetings, explanations, or markdown formatting."
    user_msg = template.format(prompt=body.prompt)

    try:
        result = await provider.generate(system, user_msg, json_mode=False)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")

    enhanced = result.get("text", body.prompt).strip()
    if enhanced.startswith('"') and enhanced.endswith('"'):
        enhanced = enhanced[1:-1]

    return {"enhanced_prompt": enhanced}


@router.get("/{presentation_id}", response_model=PresentationResponse)
async def get_presentation(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full presentation details."""
    return await _get_presentation(presentation_id, current_user, db)


@router.get("/{presentation_id}/pipeline")
async def api_get_pipeline(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get pipeline status — step states, staleness, data flow."""
    await _get_presentation(presentation_id, current_user, db)
    return await get_pipeline_status(presentation_id, db)


@router.put("/{presentation_id}", response_model=PresentationResponse)
async def update_presentation(
    presentation_id: uuid.UUID,
    body: PresentationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update presentation metadata."""
    pres = await _get_presentation(presentation_id, current_user, db)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pres, field, value)
    await db.flush()
    await db.refresh(pres)
    return pres


@router.delete("/{presentation_id}", status_code=204)
async def delete_presentation(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a presentation."""
    pres = await _get_presentation(presentation_id, current_user, db)
    pres.deleted_at = datetime.now(timezone.utc)
    await db.flush()


@router.post("/{presentation_id}/duplicate", response_model=PresentationResponse)
async def duplicate_presentation(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deep copy a presentation. Resets status to draft."""
    original = await _get_presentation(presentation_id, current_user, db)

    copy = Presentation(
        id=uuid.uuid4(),
        user_id=current_user.id,
        title=f"Copy of {original.title}",
        status=PresentationStatus.draft,
        language=original.language,
        tone=original.tone,
        audience=original.audience,
        slide_count=original.slide_count,
        llm_provider=original.llm_provider,
        llm_model=original.llm_model,
    )
    db.add(copy)
    await db.flush()
    await db.refresh(copy)
    return copy
