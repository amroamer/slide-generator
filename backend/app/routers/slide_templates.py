import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.slide_template import TemplateCollection, TemplateVariation
from app.models.user import User
from app.schemas.slide_template import (
    TemplateCollectionResponse,
    TemplateCollectionUpdate,
    TemplateVariationResponse,
    TemplateVariationUpdate,
)
from app.services.auth_service import get_current_user
from app.services.template_applier import apply_variation_to_slide
from app.services.template_processor import process_template_upload
from app.services.template_quality import compute_variation_metrics

router = APIRouter(prefix="/api/template-collections", tags=["templates"])

UPLOAD_DIR = "/app/uploads/templates"


def _variation_to_response(v: TemplateVariation) -> dict:
    design = v.design_json or {}
    metrics = v.metrics_json or {}
    return {
        "id": v.id,
        "collection_id": v.collection_id,
        "variation_index": v.variation_index,
        "variation_name": v.variation_name,
        "thumbnail_path": v.thumbnail_path,
        "tags": v.tags,
        "is_favorite": v.is_favorite,
        "usage_count": v.usage_count,
        "design_summary": {
            "layout_style": design.get("layout_style"),
            "color_palette": design.get("color_palette", [])[:6],
            "slot_count": len(design.get("content_slots", [])),
            "shape_count": len(design.get("shapes", [])),
            "estimated_items": design.get("estimated_items", 0),
        },
        "metrics": metrics,
        "created_at": v.created_at,
    }


@router.post("/upload")
async def upload_template(
    file: UploadFile,
    name: str = Form(...),
    description: str = Form(None),
    icon: str = Form(None),
    color: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PPTX file to create a template collection."""
    if not file.filename or not file.filename.endswith(".pptx"):
        raise HTTPException(status_code=400, detail="Only .pptx files are supported")

    # Save file
    upload_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    file_path = os.path.join(upload_dir, safe_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Process
    result = await process_template_upload(
        file_path=file_path,
        collection_name=name,
        description=description,
        icon=icon,
        color=color,
        user_id=current_user.id,
        db=db,
    )

    return result


@router.get("")
async def list_collections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all template collections for current user + system collections."""
    from sqlalchemy import or_
    result = await db.execute(
        select(TemplateCollection)
        .where(or_(
            TemplateCollection.user_id == current_user.id,
            TemplateCollection.is_system == True,  # noqa: E712
        ))
        .order_by(TemplateCollection.created_at.desc())
    )
    collections = result.scalars().all()

    items = []
    for c in collections:
        # Get first 4 variations for preview
        vars_result = await db.execute(
            select(TemplateVariation)
            .where(TemplateVariation.collection_id == c.id)
            .order_by(TemplateVariation.variation_index)
            .limit(4)
        )
        variations = [_variation_to_response(v) for v in vars_result.scalars().all()]

        items.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "icon": c.icon,
            "color": c.color,
            "source_filename": c.source_filename,
            "variation_count": c.variation_count,
            "is_system": c.is_system,
            "created_at": c.created_at,
            "preview_variations": variations,
        })

    return items


@router.get("/{collection_id}")
async def get_collection(
    collection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get collection with all variations."""
    collection = (await db.execute(
        select(TemplateCollection).where(TemplateCollection.id == collection_id)
    )).scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    vars_result = await db.execute(
        select(TemplateVariation)
        .where(TemplateVariation.collection_id == collection_id)
        .order_by(TemplateVariation.variation_index)
    )

    return {
        "id": collection.id,
        "name": collection.name,
        "description": collection.description,
        "icon": collection.icon,
        "color": collection.color,
        "source_filename": collection.source_filename,
        "variation_count": collection.variation_count,
        "is_system": collection.is_system,
        "created_at": collection.created_at,
        "variations": [_variation_to_response(v) for v in vars_result.scalars().all()],
    }


@router.put("/{collection_id}")
async def update_collection(
    collection_id: uuid.UUID,
    body: TemplateCollectionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update collection metadata."""
    collection = (await db.execute(
        select(TemplateCollection).where(
            TemplateCollection.id == collection_id,
            TemplateCollection.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(collection, field, value)
    await db.flush()

    return {"status": "updated"}


@router.delete("/{collection_id}")
async def delete_collection(
    collection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete collection, all variations, and cleanup files."""
    collection = (await db.execute(
        select(TemplateCollection).where(
            TemplateCollection.id == collection_id,
            TemplateCollection.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system templates")

    # Delete variations
    vars_result = await db.execute(
        select(TemplateVariation).where(TemplateVariation.collection_id == collection_id)
    )
    for v in vars_result.scalars().all():
        await db.delete(v)
    await db.delete(collection)

    # Cleanup files from disk
    import shutil
    template_dir = os.path.join(UPLOAD_DIR, str(collection_id))
    if os.path.exists(template_dir):
        shutil.rmtree(template_dir, ignore_errors=True)
    # Cleanup source PPTX
    if collection.source_file_path and os.path.exists(collection.source_file_path):
        try:
            os.remove(collection.source_file_path)
        except OSError:
            pass

    return {"deleted": True, "collection_id": str(collection_id)}


@router.post("/{collection_id}/recompute-metrics")
async def recompute_metrics(
    collection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recompute quality metrics for all variations in a collection."""
    collection = (await db.execute(
        select(TemplateCollection).where(TemplateCollection.id == collection_id)
    )).scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    vars_result = await db.execute(
        select(TemplateVariation).where(TemplateVariation.collection_id == collection_id)
    )
    variations = vars_result.scalars().all()
    updated = 0
    for v in variations:
        objects_data = dict(v.objects_json) if v.objects_json else {}
        design = v.design_json or {}
        if "content_slots" not in objects_data and design.get("content_slots"):
            objects_data["content_slots"] = design["content_slots"]
        v.metrics_json = compute_variation_metrics(objects_data if objects_data else None)
        updated += 1
    await db.flush()
    return {"updated": updated, "collection_id": str(collection_id)}


@router.delete("/{collection_id}/variations/{variation_id}")
async def delete_variation(
    collection_id: uuid.UUID,
    variation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single variation. If last variation, deletes collection too."""
    # Verify collection ownership
    collection = (await db.execute(
        select(TemplateCollection).where(
            TemplateCollection.id == collection_id,
            TemplateCollection.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    variation = (await db.execute(
        select(TemplateVariation).where(
            TemplateVariation.id == variation_id,
            TemplateVariation.collection_id == collection_id,
        )
    )).scalar_one_or_none()
    if not variation:
        raise HTTPException(status_code=404, detail="Variation not found")

    # Delete thumbnail file
    if variation.thumbnail_path:
        full_path = os.path.join("/app", variation.thumbnail_path.lstrip("/"))
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError:
                pass

    await db.delete(variation)
    collection.variation_count = max(0, collection.variation_count - 1)
    remaining = collection.variation_count

    # If no variations left, delete the collection too
    if remaining <= 0:
        import shutil
        template_dir = os.path.join(UPLOAD_DIR, str(collection_id))
        if os.path.exists(template_dir):
            shutil.rmtree(template_dir, ignore_errors=True)
        await db.delete(collection)

    return {"deleted": True, "variation_id": str(variation_id), "remaining_variations": remaining}


@router.put("/{collection_id}/variations/{variation_id}")
async def update_variation(
    collection_id: uuid.UUID,
    variation_id: uuid.UUID,
    body: TemplateVariationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update variation name/tags."""
    variation = (await db.execute(
        select(TemplateVariation).where(TemplateVariation.id == variation_id)
    )).scalar_one_or_none()
    if not variation:
        raise HTTPException(status_code=404, detail="Variation not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(variation, field, value)
    await db.flush()
    return _variation_to_response(variation)


@router.post("/{collection_id}/variations/{variation_id}/favorite")
async def toggle_favorite(
    collection_id: uuid.UUID,
    variation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle favorite status."""
    variation = (await db.execute(
        select(TemplateVariation).where(TemplateVariation.id == variation_id)
    )).scalar_one_or_none()
    if not variation:
        raise HTTPException(status_code=404, detail="Variation not found")
    variation.is_favorite = not variation.is_favorite
    await db.flush()
    return {"is_favorite": variation.is_favorite}


@router.post("/{collection_id}/variations/{variation_id}/apply/{presentation_id}/{slide_id}")
async def apply_template(
    collection_id: uuid.UUID,
    variation_id: uuid.UUID,
    presentation_id: uuid.UUID,
    slide_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a template variation to a presentation slide."""
    return await apply_variation_to_slide(variation_id, presentation_id, slide_id, db)


@router.get("/{collection_id}/variations/{variation_id}/objects")
async def get_variation_objects(
    collection_id: uuid.UUID,
    variation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full parsed object tree for a variation."""
    variation = (await db.execute(
        select(TemplateVariation).where(
            TemplateVariation.id == variation_id,
            TemplateVariation.collection_id == collection_id,
        )
    )).scalar_one_or_none()
    if not variation:
        raise HTTPException(status_code=404, detail="Variation not found")

    objects = variation.objects_json or {}
    return {
        "variation_id": str(variation.id),
        "variation_name": variation.variation_name,
        "object_count": objects.get("object_count", 0),
        "color_palette": objects.get("color_palette", []),
        "font_inventory": objects.get("font_inventory", []),
        "has_images": objects.get("has_images", False),
        "has_charts": objects.get("has_charts", False),
        "has_tables": objects.get("has_tables", False),
        "background": objects.get("background"),
        "objects": objects.get("objects", []),
    }
