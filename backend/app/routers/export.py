import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.presentation import Presentation, PresentationStatus
from app.models.user import User
from app.routers.presentations import _get_presentation
from app.services.auth_service import get_current_user
from app.services.export_service import generate_pptx
from app.services.pipeline_manager import record_step_change

router = APIRouter(prefix="/api/presentations", tags=["export"])


class ExportRequest(BaseModel):
    slide_ids: list[str] | None = None


class PdfExportRequest(BaseModel):
    slide_ids: list[str] | None = None
    include_notes: bool = False


@router.post("/{presentation_id}/export/pptx")
async def export_pptx(
    presentation_id: uuid.UUID,
    body: ExportRequest = ExportRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate and download PPTX file."""
    pres = await _get_presentation(presentation_id, current_user, db)

    filepath = await generate_pptx(presentation_id, body.slide_ids, db)

    pres.status = PresentationStatus.exported
    await record_step_change(presentation_id, "export", db)
    await db.flush()

    return FileResponse(
        path=filepath,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=filepath.rsplit("/", 1)[-1],
    )


@router.post("/{presentation_id}/export/pdf")
async def export_pdf(
    presentation_id: uuid.UUID,
    body: PdfExportRequest = PdfExportRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate and download PDF file."""
    pres = await _get_presentation(presentation_id, current_user, db)

    from app.services.pdf_export import generate_pdf
    filepath = await generate_pdf(presentation_id, body.slide_ids, body.include_notes, db)

    pres.status = PresentationStatus.exported
    await record_step_change(presentation_id, "export", db)
    await db.flush()

    return FileResponse(
        path=filepath,
        media_type="application/pdf",
        filename=filepath.rsplit("/", 1)[-1],
    )
