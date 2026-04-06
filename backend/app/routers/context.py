import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.presentation import Presentation
from app.models.presentation_input import PresentationInput
from app.models.presentation_plan import PresentationPlan
from app.models.slide import PresentationSlide
from app.models.user import User
from app.routers.presentations import _get_presentation
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/presentations", tags=["context"])


@router.get("/{presentation_id}/slides/{slide_id}/source-data")
async def get_slide_source_data(
    presentation_id: uuid.UUID,
    slide_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return relevant source data for a specific slide based on its data_references."""
    await _get_presentation(presentation_id, current_user, db)

    # Load input for raw data
    inp = (await db.execute(
        select(PresentationInput).where(PresentationInput.presentation_id == presentation_id)
    )).scalar_one_or_none()

    # Load plan to get slide's data_references
    plan = (await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()

    # Find data_references for this slide in the plan
    refs: list[str] = []
    if plan:
        for section in plan.plan_json.get("sections", []):
            for sl in section.get("slides", []):
                if sl.get("slide_id") == slide_id:
                    refs = sl.get("data_references", [])
                    break

    # Also check the slide's content_json for data references
    slide_result = await db.execute(
        select(PresentationSlide).where(
            PresentationSlide.presentation_id == presentation_id,
            PresentationSlide.slide_id == slide_id,
        )
    )
    slide = slide_result.scalar_one_or_none()

    files_data = []
    if inp and inp.raw_data_json and inp.raw_data_json.get("files"):
        for f in inp.raw_data_json["files"]:
            fname = f.get("filename", "")
            ftype = f.get("type", "")

            # Check if this file is referenced
            is_referenced = any(fname in ref for ref in refs) if refs else True

            if ftype == "tabular":
                if "sheets" in f:
                    for sheet in f["sheets"]:
                        files_data.append({
                            "filename": fname,
                            "sheet": sheet.get("sheet_name"),
                            "type": "tabular",
                            "referenced": is_referenced,
                            "columns": sheet.get("columns", []),
                            "row_count": sheet.get("row_count", 0),
                            "sample_rows": sheet.get("sample_rows", [])[:10],
                            "stats": sheet.get("stats", {}),
                        })
                else:
                    files_data.append({
                        "filename": fname,
                        "type": "tabular",
                        "referenced": is_referenced,
                        "columns": f.get("columns", []),
                        "row_count": f.get("row_count", 0),
                        "sample_rows": f.get("sample_rows", [])[:10],
                        "stats": f.get("stats", {}),
                    })
            elif ftype == "text":
                files_data.append({
                    "filename": fname,
                    "type": "text",
                    "referenced": is_referenced,
                    "text_preview": f.get("text_content", "")[:500],
                    "char_count": f.get("char_count", 0),
                })
            elif ftype == "structured":
                files_data.append({
                    "filename": fname,
                    "type": "structured",
                    "referenced": is_referenced,
                    "data_preview": str(f.get("data", ""))[:500],
                })

    return {
        "slide_id": slide_id,
        "data_references": refs,
        "files": files_data,
        "slide_content_summary": {
            "title": slide.title if slide else "",
            "has_chart": bool(slide and slide.content_json and slide.content_json.get("chart_data")),
            "has_table": bool(slide and slide.content_json and slide.content_json.get("data_table")),
        } if slide else None,
    }


@router.get("/{presentation_id}/context-summary")
async def get_context_summary(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return presentation summary for the export context panel."""
    pres = await _get_presentation(presentation_id, current_user, db)

    inp = (await db.execute(
        select(PresentationInput).where(PresentationInput.presentation_id == presentation_id)
    )).scalar_one_or_none()

    plan = (await db.execute(
        select(PresentationPlan).where(
            PresentationPlan.presentation_id == presentation_id,
            PresentationPlan.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()

    slides = (await db.execute(
        select(PresentationSlide)
        .where(PresentationSlide.presentation_id == presentation_id)
        .order_by(PresentationSlide.order)
    )).scalars().all()

    # Calculate stats
    total_words = 0
    slide_summaries = []
    for s in slides:
        cj = s.content_json or {}
        body = (cj.get("body") or {}).get("content") or []
        words = sum(len(str(b).split()) for b in body)
        total_words += words
        slide_summaries.append({
            "slide_id": s.slide_id,
            "title": s.title,
            "layout": s.layout,
            "word_count": words,
            "has_chart": bool(cj.get("chart_data")),
            "has_table": bool(cj.get("data_table")),
        })

    est_minutes = max(1, round(total_words / 150))  # ~150 words per minute
    file_names = inp.file_paths if inp and inp.file_paths else []

    return {
        "title": pres.title,
        "language": pres.language.value if hasattr(pres.language, "value") else str(pres.language),
        "tone": pres.tone,
        "audience": pres.audience,
        "llm_provider": pres.llm_provider,
        "llm_model": pres.llm_model,
        "slide_count": len(slides),
        "total_words": total_words,
        "estimated_minutes": est_minutes,
        "slides": slide_summaries,
        "data_sources": file_names,
        "plan_version": plan.version if plan else 0,
        "timeline": {
            "input_saved": str(pres.input_modified_at) if pres.input_modified_at else None,
            "plan_generated": str(pres.plan_modified_at) if pres.plan_modified_at else None,
            "content_generated": str(pres.content_modified_at) if pres.content_modified_at else None,
            "designs_applied": str(pres.design_modified_at) if pres.design_modified_at else None,
            "last_exported": str(pres.last_exported_at) if pres.last_exported_at else None,
        },
    }
