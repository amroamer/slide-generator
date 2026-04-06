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


@router.get("", response_model=PresentationListResponse)
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

    return PresentationListResponse(
        items=[PresentationResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


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
