import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.pipeline_manager import record_step_change
from app.models.presentation_plan import PresentationPlan
from app.models.user import User
from app.routers.presentations import _get_presentation
from app.schemas.plan import (
    PlanRefineRequest,
    PlanRegenerateRequest,
    PlanResponse,
    PlanUpdateRequest,
    PlanVersionSummary,
)
from app.services.auth_service import get_current_user
from app.services.planner_agent import (
    generate_plan,
    refine_section,
    refine_slide,
    regenerate_full_plan,
)

router = APIRouter(prefix="/api/presentations", tags=["plans"])


async def _save_plan_version(
    presentation_id: uuid.UUID, plan_json: dict, db: AsyncSession
) -> PresentationPlan:
    """Save a direct edit as a new plan version."""
    from app.services.planner_agent import _deactivate_plans, _get_next_version

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


@router.post("/{presentation_id}/plan/generate", response_model=PlanResponse)
async def api_generate_plan(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new plan using the Planner Agent."""
    await _get_presentation(presentation_id, current_user, db)
    result = await generate_plan(presentation_id, current_user, db)
    await record_step_change(presentation_id, "plan", db)
    plan_result = await db.execute(
        select(PresentationPlan).where(PresentationPlan.id == uuid.UUID(result["id"]))
    )
    return plan_result.scalar_one()


@router.get("/{presentation_id}/plan", response_model=PlanResponse)
async def get_active_plan(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the active plan for a presentation."""
    await _get_presentation(presentation_id, current_user, db)
    result = await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan generated yet")
    return plan


@router.get(
    "/{presentation_id}/plan/versions",
    response_model=list[PlanVersionSummary],
)
async def list_plan_versions(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all plan versions."""
    await _get_presentation(presentation_id, current_user, db)
    result = await db.execute(
        select(PresentationPlan)
        .where(PresentationPlan.presentation_id == presentation_id)
        .order_by(PresentationPlan.version.desc())
    )
    return result.scalars().all()


@router.get(
    "/{presentation_id}/plan/versions/{version}",
    response_model=PlanResponse,
)
async def get_plan_version(
    presentation_id: uuid.UUID,
    version: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific plan version."""
    await _get_presentation(presentation_id, current_user, db)
    result = await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.version == version,
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Version not found")
    return plan


@router.put("/{presentation_id}/plan", response_model=PlanResponse)
async def update_plan(
    presentation_id: uuid.UUID,
    body: PlanUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save direct edits as a new plan version."""
    await _get_presentation(presentation_id, current_user, db)
    plan = await _save_plan_version(presentation_id, body.plan_json, db)
    await record_step_change(presentation_id, "plan", db)
    return plan


@router.post("/{presentation_id}/plan/refine", response_model=PlanResponse)
async def api_refine_plan(
    presentation_id: uuid.UUID,
    body: PlanRefineRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Refine a single slide or section."""
    await _get_presentation(presentation_id, current_user, db)

    if body.slide_id:
        result = await refine_slide(
            presentation_id, body.slide_id, body.instruction, current_user, db
        )
    elif body.section_id:
        result = await refine_section(
            presentation_id, body.section_id, body.instruction, current_user, db
        )
    else:
        raise HTTPException(
            status_code=400, detail="Provide slide_id or section_id"
        )

    await record_step_change(presentation_id, "plan", db)
    plan_result = await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.id == uuid.UUID(result["id"])
        )
    )
    return plan_result.scalar_one()


@router.post("/{presentation_id}/plan/regenerate", response_model=PlanResponse)
async def api_regenerate_plan(
    presentation_id: uuid.UUID,
    body: PlanRegenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate the entire plan with additional instruction."""
    await _get_presentation(presentation_id, current_user, db)
    result = await regenerate_full_plan(
        presentation_id, body.instruction, current_user, db
    )
    await record_step_change(presentation_id, "plan", db)
    plan_result = await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.id == uuid.UUID(result["id"])
        )
    )
    return plan_result.scalar_one()
