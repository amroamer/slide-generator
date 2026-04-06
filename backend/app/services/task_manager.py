"""Simple task tracking using Redis for background generation progress."""

import json
from datetime import datetime, timezone

import redis.asyncio as aioredis

from app.config import settings


class TaskManager:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def create_task(self, task_id: str, total_steps: int, task_type: str) -> dict:
        task = {
            "task_id": task_id,
            "task_type": task_type,
            "status": "running",
            "total": total_steps,
            "completed": 0,
            "current_step": "",
            "current_step_title": "",
            "steps_ready": [],
            "failed": [],
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": None,
        }
        r = await self._get_redis()
        await r.set(f"task:{task_id}", json.dumps(task), ex=3600)
        return task

    async def set_current_step(self, task_id: str, slide_id: str, slide_title: str):
        r = await self._get_redis()
        raw = await r.get(f"task:{task_id}")
        if not raw:
            return
        task = json.loads(raw)
        task["current_step"] = slide_id
        task["current_step_title"] = slide_title
        task["status"] = "running"
        await r.set(f"task:{task_id}", json.dumps(task), ex=3600)

    async def update_progress(self, task_id: str, slide_id: str, detail: str, status: str = "completed"):
        r = await self._get_redis()
        raw = await r.get(f"task:{task_id}")
        if not raw:
            return
        task = json.loads(raw)
        if status == "completed":
            task["completed"] += 1
            if slide_id not in task["steps_ready"]:
                task["steps_ready"].append(slide_id)
        elif status == "failed":
            task["failed"].append({"slide_id": slide_id, "error": detail})
        task["current_step"] = slide_id
        task["current_step_title"] = detail if status == "completed" else ""
        if task["completed"] + len(task["failed"]) >= task["total"]:
            task["status"] = "completed"
            task["finished_at"] = datetime.now(timezone.utc).isoformat()
        await r.set(f"task:{task_id}", json.dumps(task), ex=3600)

    async def get_progress(self, task_id: str) -> dict:
        r = await self._get_redis()
        raw = await r.get(f"task:{task_id}")
        if not raw:
            return {"status": "not_found"}
        return json.loads(raw)

    async def cancel_task(self, task_id: str):
        r = await self._get_redis()
        raw = await r.get(f"task:{task_id}")
        if raw:
            task = json.loads(raw)
            task["status"] = "cancelled"
            await r.set(f"task:{task_id}", json.dumps(task), ex=3600)


task_manager = TaskManager()
