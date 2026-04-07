import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.pipeline_manager import record_step_change
from app.models.slide import PresentationSlide
from app.models.user import User
from app.routers.presentations import _get_presentation
from app.schemas.slide import (
    ContentRegenerateRequest,
    SlideRefineRequest,
    SlideResponse,
    SlideUpdateRequest,
)
from app.services.auth_service import get_current_user
from app.services.designer_agent import generate_designs, redesign_slide
from app.services.writer_agent import (
    generate_alternatives,
    generate_content,
    refine_slide_content,
    regenerate_all_content,
)

router = APIRouter(prefix="/api/presentations", tags=["slides"])


@router.post("/{presentation_id}/content/generate", status_code=202)
async def api_generate_content(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start background content generation. Returns task_id for polling."""
    await _get_presentation(presentation_id, current_user, db)
    from app.services.writer_agent import start_content_generation
    task_id, total = await start_content_generation(presentation_id, current_user, db)
    await record_step_change(presentation_id, "content", db)
    return {"task_id": task_id, "status": "started", "total": total}


@router.get("/{presentation_id}/slides", response_model=list[SlideResponse])
async def list_slides(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all slides for a presentation."""
    await _get_presentation(presentation_id, current_user, db)
    result = await db.execute(
        select(PresentationSlide)
        .where(PresentationSlide.presentation_id == presentation_id)
        .order_by(PresentationSlide.order)
    )
    return result.scalars().all()


@router.get("/{presentation_id}/slides/{slide_id}", response_model=SlideResponse)
async def get_slide(
    presentation_id: uuid.UUID,
    slide_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single slide."""
    await _get_presentation(presentation_id, current_user, db)
    result = await db.execute(
        select(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id,
            PresentationSlide.slide_id == slide_id,
        )
    )
    slide = result.scalar_one_or_none()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")
    return slide


@router.put("/{presentation_id}/slides/{slide_id}", response_model=SlideResponse)
async def update_slide(
    presentation_id: uuid.UUID,
    slide_id: str,
    body: SlideUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a slide's title and/or content."""
    await _get_presentation(presentation_id, current_user, db)
    result = await db.execute(
        select(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id,
            PresentationSlide.slide_id == slide_id,
        )
    )
    slide = result.scalar_one_or_none()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")

    if body.title is not None:
        slide.title = body.title
    if body.content_json is not None:
        slide.content_json = body.content_json
    await record_step_change(presentation_id, "content", db)
    await db.flush()
    await db.refresh(slide)
    return slide


@router.post(
    "/{presentation_id}/slides/{slide_id}/refine",
    response_model=SlideResponse,
)
async def api_refine_slide(
    presentation_id: uuid.UUID,
    slide_id: str,
    body: SlideRefineRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Refine a single slide via the Writer Agent."""
    await _get_presentation(presentation_id, current_user, db)
    await refine_slide_content(
        presentation_id, slide_id, body.instruction, current_user, db
    )
    await record_step_change(presentation_id, "content", db)
    result = await db.execute(
        select(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id,
            PresentationSlide.slide_id == slide_id,
        )
    )
    return result.scalar_one()


@router.post(
    "/{presentation_id}/content/regenerate",
    response_model=list[SlideResponse],
)
async def api_regenerate_content(
    presentation_id: uuid.UUID,
    body: ContentRegenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate all content with optional additional instruction."""
    await _get_presentation(presentation_id, current_user, db)
    await regenerate_all_content(
        presentation_id, body.instruction, current_user, db
    )
    await record_step_change(presentation_id, "content", db)
    result = await db.execute(
        select(PresentationSlide)
        .where(PresentationSlide.presentation_id == presentation_id)
        .order_by(PresentationSlide.order)
    )
    return result.scalars().all()


@router.post("/{presentation_id}/slides/{slide_id}/alternatives")
async def api_generate_alternatives(
    presentation_id: uuid.UUID,
    slide_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate 3 alternative content versions for a slide."""
    await _get_presentation(presentation_id, current_user, db)
    return await generate_alternatives(presentation_id, slide_id, current_user, db)


# ─── Design endpoints ────────────────────────────────────────────────────────


@router.post("/{presentation_id}/design/generate", response_model=list[SlideResponse])
async def api_generate_designs(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate visual designs for all slides."""
    await _get_presentation(presentation_id, current_user, db)
    await generate_designs(presentation_id, current_user, db)
    await record_step_change(presentation_id, "design", db)
    result = await db.execute(
        select(PresentationSlide)
        .where(PresentationSlide.presentation_id == presentation_id)
        .order_by(PresentationSlide.order)
    )
    return result.scalars().all()


class DesignUpdateRequest(SlideUpdateRequest):
    layout: str | None = None
    design_json: dict | None = None
    template_variation_id: str | None = None


@router.put("/{presentation_id}/slides/{slide_id}/design", response_model=SlideResponse)
async def update_slide_design(
    presentation_id: uuid.UUID,
    slide_id: str,
    body: DesignUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a slide's layout and design."""
    await _get_presentation(presentation_id, current_user, db)
    result = await db.execute(
        select(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id,
            PresentationSlide.slide_id == slide_id,
        )
    )
    slide = result.scalar_one_or_none()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")
    if body.layout is not None:
        slide.layout = body.layout
    if body.design_json is not None:
        slide.design_json = body.design_json
    if body.template_variation_id is not None:
        import uuid as _uuid
        slide.template_variation_id = _uuid.UUID(body.template_variation_id) if body.template_variation_id else None
    await record_step_change(presentation_id, "design", db)
    await db.flush()
    await db.refresh(slide)
    return slide


@router.post("/{presentation_id}/slides/{slide_id}/design/refine", response_model=SlideResponse)
async def api_refine_design(
    presentation_id: uuid.UUID,
    slide_id: str,
    body: SlideRefineRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Refine a single slide's design via Designer Agent."""
    await _get_presentation(presentation_id, current_user, db)
    await redesign_slide(presentation_id, slide_id, body.instruction, current_user, db)
    await record_step_change(presentation_id, "design", db)
    result = await db.execute(
        select(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id,
            PresentationSlide.slide_id == slide_id,
        )
    )
    return result.scalar_one()
