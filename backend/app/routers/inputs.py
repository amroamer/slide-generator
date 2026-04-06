import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.pipeline_manager import record_step_change
from app.models.presentation import Presentation, PresentationStatus
from app.models.presentation_input import PresentationInput
from app.models.user import User
from app.routers.presentations import _get_presentation
from app.services.auth_service import get_current_user
from app.services.file_parser import parse_file

router = APIRouter(prefix="/api/presentations", tags=["inputs"])

UPLOAD_DIR = "/app/uploads"


class InputSaveRequest(BaseModel):
    prompt: str = ""
    audience: str | None = None
    tone: str | None = None
    language: str | None = None
    slide_count: int = Field(10, ge=1, le=50)
    template_id: uuid.UUID | None = None
    brand_profile_id: uuid.UUID | None = None
    llm_provider: str | None = None
    llm_model: str | None = None


class InputResponse(BaseModel):
    id: uuid.UUID
    presentation_id: uuid.UUID
    prompt: str
    raw_data_json: dict | None = None
    file_paths: list | None = None
    audience: str | None = None
    tone: str | None = None
    language: str | None = None
    slide_count: int
    template_id: uuid.UUID | None = None
    brand_profile_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


def _gather_file_data(presentation_id: uuid.UUID) -> tuple[list[str], dict]:
    """Scan upload dir, parse all files, return (file_paths, raw_data_json)."""
    upload_dir = os.path.join(UPLOAD_DIR, str(presentation_id))
    file_paths: list[str] = []
    parsed_files: list[dict] = []

    if os.path.exists(upload_dir):
        for name in sorted(os.listdir(upload_dir)):
            path = os.path.join(upload_dir, name)
            if os.path.isfile(path):
                file_paths.append(name)
                parsed_files.append(parse_file(path, name))

    raw_data = {"files": parsed_files} if parsed_files else None
    return file_paths, raw_data


@router.post("/{presentation_id}/input", response_model=InputResponse)
async def save_input(
    presentation_id: uuid.UUID,
    body: InputSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save Step 1 input data and advance presentation to input_complete."""
    pres = await _get_presentation(presentation_id, current_user, db)

    file_paths, raw_data = _gather_file_data(presentation_id)

    # Upsert presentation_input
    result = await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )
    inp = result.scalar_one_or_none()

    if inp:
        inp.prompt = body.prompt
        inp.raw_data_json = raw_data
        inp.file_paths = file_paths
        inp.audience = body.audience
        inp.tone = body.tone
        inp.language = body.language
        inp.slide_count = body.slide_count
        inp.template_id = body.template_id
        inp.brand_profile_id = body.brand_profile_id
    else:
        inp = PresentationInput(
            id=uuid.uuid4(),
            presentation_id=presentation_id,
            prompt=body.prompt,
            raw_data_json=raw_data,
            file_paths=file_paths,
            audience=body.audience,
            tone=body.tone,
            language=body.language,
            slide_count=body.slide_count,
            template_id=body.template_id,
            brand_profile_id=body.brand_profile_id,
        )
        db.add(inp)

    # Update presentation metadata — only advance status forward, never regress
    if pres.status == PresentationStatus.draft:
        pres.status = PresentationStatus.input_complete
    if body.audience:
        pres.audience = body.audience
    if body.tone:
        pres.tone = body.tone
    if body.language:
        pres.language = body.language
    pres.slide_count = body.slide_count
    if body.llm_provider:
        pres.llm_provider = body.llm_provider
    if body.llm_model:
        pres.llm_model = body.llm_model

    await record_step_change(presentation_id, "input", db)
    await db.flush()
    await db.refresh(inp)
    return inp


@router.get("/{presentation_id}/input", response_model=InputResponse)
async def get_input(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve saved input for a presentation."""
    await _get_presentation(presentation_id, current_user, db)

    result = await db.execute(
        select(PresentationInput).where(
            PresentationInput.presentation_id == presentation_id
        )
    )
    inp = result.scalar_one_or_none()
    if not inp:
        raise HTTPException(status_code=404, detail="Input not saved yet")
    return inp
