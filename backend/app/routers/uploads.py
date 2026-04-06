import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.routers.presentations import _get_presentation
from app.services.auth_service import get_current_user
from app.services.pipeline_manager import record_step_change
from app.services.file_parser import SUPPORTED_EXTENSIONS, parse_file

router = APIRouter(prefix="/api/presentations", tags=["uploads"])

UPLOAD_DIR = "/app/uploads"
MAX_FILE_SIZE = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024  # bytes
MAX_TOTAL_SIZE = 100 * 1024 * 1024  # 100MB


@router.post("/{presentation_id}/upload")
async def upload_files(
    presentation_id: uuid.UUID,
    files: list[UploadFile],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload files for a presentation. Parses each file automatically."""
    await _get_presentation(presentation_id, current_user, db)

    upload_dir = os.path.join(UPLOAD_DIR, str(presentation_id))
    os.makedirs(upload_dir, exist_ok=True)

    results = []
    total_size = 0

    for file in files:
        # Validate extension
        ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if file.filename and "." in file.filename else ""
        if ext not in SUPPORTED_EXTENSIONS:
            results.append({
                "filename": file.filename,
                "size": 0,
                "type": "error",
                "parse_status": "rejected",
                "error": f"Unsupported file type: {ext}",
            })
            continue

        # Read and validate size
        content = await file.read()
        file_size = len(content)

        if file_size > MAX_FILE_SIZE:
            results.append({
                "filename": file.filename,
                "size": file_size,
                "type": "error",
                "parse_status": "rejected",
                "error": f"File exceeds {settings.UPLOAD_MAX_SIZE_MB}MB limit",
            })
            continue

        total_size += file_size
        if total_size > MAX_TOTAL_SIZE:
            results.append({
                "filename": file.filename,
                "size": file_size,
                "type": "error",
                "parse_status": "rejected",
                "error": "Total upload size exceeds 100MB",
            })
            continue

        # Save file
        safe_name = file.filename.replace("/", "_").replace("\\", "_")
        file_path = os.path.join(upload_dir, safe_name)
        with open(file_path, "wb") as f:
            f.write(content)

        # Parse
        parsed = parse_file(file_path, safe_name)

        # Build preview snippet
        preview = None
        if parsed.get("type") == "tabular":
            if "sheets" in parsed:
                sheet = parsed["sheets"][0]
                preview = {
                    "columns": sheet["columns"],
                    "rows": sheet["sample_rows"][:10],
                    "row_count": sheet["row_count"],
                }
            else:
                preview = {
                    "columns": parsed["columns"],
                    "rows": parsed["sample_rows"][:10],
                    "row_count": parsed["row_count"],
                }
        elif parsed.get("type") == "text":
            text = parsed.get("text_content", "")
            preview = {"text": text[:500], "char_count": parsed.get("char_count", 0)}
        elif parsed.get("type") == "structured":
            preview = {"data_preview": str(parsed.get("data", ""))[:500]}

        results.append({
            "filename": safe_name,
            "size": file_size,
            "type": parsed.get("type", "unknown"),
            "parse_status": "error" if parsed.get("type") == "error" else "success",
            "preview": preview,
            "parsed_data": parsed,
            "error": parsed.get("error"),
        })

    if results:
        await record_step_change(presentation_id, "input", db)
    return results


@router.get("/{presentation_id}/files")
async def list_files(
    presentation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List uploaded files for a presentation."""
    await _get_presentation(presentation_id, current_user, db)

    upload_dir = os.path.join(UPLOAD_DIR, str(presentation_id))
    if not os.path.exists(upload_dir):
        return []

    files = []
    for name in sorted(os.listdir(upload_dir)):
        path = os.path.join(upload_dir, name)
        if os.path.isfile(path):
            files.append({
                "filename": name,
                "size": os.path.getsize(path),
            })
    return files


@router.delete("/{presentation_id}/files/{filename}", status_code=204)
async def delete_file(
    presentation_id: uuid.UUID,
    filename: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a specific uploaded file."""
    await _get_presentation(presentation_id, current_user, db)

    file_path = os.path.join(UPLOAD_DIR, str(presentation_id), filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    os.remove(file_path)
    await record_step_change(presentation_id, "input", db)
