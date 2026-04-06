from fastapi import APIRouter, Depends, HTTPException

from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.task_manager import task_manager

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/{task_id}/progress")
async def get_task_progress(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get current progress of a background task."""
    progress = await task_manager.get_progress(task_id)
    if progress.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Task not found")
    return progress


@router.post("/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """Cancel a running background task."""
    await task_manager.cancel_task(task_id)
    return {"status": "cancelled", "task_id": task_id}
