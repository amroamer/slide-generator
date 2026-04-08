from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.routers import auth, brand_profiles, context, export, guide, inputs, llm_settings, plans, presentations, prompt_settings, slide_templates, slides, tasks, uploads


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.redis = aioredis.from_url(
        settings.REDIS_URL, decode_responses=True
    )
    # Seed default prompts and brand profiles if missing
    try:
        from seed_data.seed import run_all_seeds
        from app.database import async_session_factory
        async with async_session_factory() as db:
            await run_all_seeds(db)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Seed failed (non-fatal): %s", e)
    yield
    # Shutdown
    await app.state.redis.close()
    await engine.dispose()


app = FastAPI(
    title="Slides Generator by KPMG",
    description="AI-Powered Executive Presentation Generator",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(brand_profiles.router)
app.include_router(llm_settings.router)
app.include_router(presentations.router)
app.include_router(uploads.router)
app.include_router(inputs.router)
app.include_router(plans.router)
app.include_router(slides.router)
app.include_router(export.router)
app.include_router(guide.router)
app.include_router(context.router)
app.include_router(prompt_settings.router)
app.include_router(slide_templates.router)
app.include_router(tasks.router)


# Serve uploaded template thumbnails as static files
import os
if os.path.exists("/app/uploads"):
    from fastapi.staticfiles import StaticFiles
    app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")


@app.get("/api/health")
async def health_check():
    """Health check endpoint — verifies DB and Redis connectivity."""
    health = {"status": "healthy", "db": "ok", "redis": "ok"}

    # Check database
    try:
        async with engine.connect() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
    except Exception as e:
        health["db"] = f"error: {e}"
        health["status"] = "unhealthy"

    # Check Redis
    try:
        await app.state.redis.ping()
    except Exception as e:
        health["redis"] = f"error: {e}"
        health["status"] = "unhealthy"

    return health
