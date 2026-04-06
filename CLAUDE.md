# CLAUDE.md — Project Guide for Claude Code

## Project Overview

**Slides Generator by KPMG** — A full-stack AI-powered presentation generator with a 5-step pipeline: Input Collection → Plan Generation → Content Generation → Visual Design → Export. Each step is powered by an AI agent that calls LLMs (Claude, OpenAI, or local Ollama/Gemma4).

## Tech Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Recharts
- **Backend**: FastAPI (async), SQLAlchemy (asyncpg), Alembic migrations
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7
- **Infrastructure**: Docker Compose (frontend, backend, db, nginx, redis)
- **LLM Providers**: Claude (Anthropic), OpenAI, Ollama (local — Gemma4, Qwen2.5)
- **Export**: python-pptx (PPTX), WeasyPrint (PDF), python-docx (DOCX)

## Project Structure

```
backend/
  app/
    main.py              # FastAPI app, router registration, static files
    config.py            # Pydantic settings (env vars)
    database.py          # SQLAlchemy async engine + session factory
    models/              # SQLAlchemy models (presentation, slide, user, etc.)
    routers/             # API route handlers
    services/            # Business logic (agents, export, pipeline, etc.)
    llm/                 # LLM provider abstraction (base, claude, openai, ollama)
    prompts/             # Hardcoded prompt templates (fallbacks)
    schemas/             # Pydantic request/response schemas
  alembic/               # Database migrations
  templates/pdf/         # Jinja2 templates for PDF export
  requirements.txt

frontend/
  app/                   # Next.js App Router pages
    (auth)/              # Login, register pages
    dashboard/           # Presentation list
    presentation/[id]/   # Workspace with step1-step5 pages
    settings/            # LLM, prompts, templates, brand profiles, guide editor
    guide/               # Public user guide page
  components/
    slides/              # SlideRenderer + 7 layout components + chart renderer
    steps/               # Step-specific UI components (config panel, content cards, etc.)
    settings/            # Settings page components (object inspector, etc.)
  lib/                   # Shared hooks, contexts, API client, i18n

nginx/nginx.conf         # Reverse proxy config
docker-compose.yml       # Production stack
```

## Key Architectural Patterns

### Base Path
The app runs under `/slide-generator/` base path:
- `next.config.js`: `basePath: "/slide-generator"`
- `lib/api.ts`: `baseURL: "/slide-generator/api"`
- Nginx rewrites `/slide-generator/api/` → backend `/api/`
- All `<Link>` hrefs are auto-prefixed by Next.js

### LLM Resolution Chain
`services/llm_resolver.py` → presentation override → user default → system default → env vars. API keys stored encrypted in `llm_configs` table.

### Pipeline State
`services/pipeline_manager.py` computes staleness across 5 steps. Frontend checks `has_*` flags before fetching step-specific data to avoid 404s.

### Brand Profiles
Stored in `brand_profiles` table with 40+ fields. Loaded via `services/brand_loader.py`. Applied in PPTX export (`export_service.py`), PDF export (`pdf_export.py`), and frontend slide preview (passed as `primary`/`accent` props to `SlideRenderer`).

### Prompt System
DB-backed prompts in `prompt_configs` table. `services/prompt_service.py` resolves: user override → system default → code fallback. Supports `{variable}` substitution via `SafeDict`.

## Common Commands

```bash
# Start the full stack
docker compose up -d

# Rebuild after code changes
docker compose up backend frontend --build -d

# Run migrations
docker compose exec backend alembic upgrade head

# Check logs
docker compose logs backend --tail 30
docker compose logs frontend --tail 20

# Test API
curl http://localhost:8080/slide-generator/api/health

# Push to GitHub
git add -A && git commit -m "message" && git push origin main
```

## Environment Variables (.env)

```
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/slides
REDIS_URL=redis://redis:6379
ANTHROPIC_API_KEY=        # Optional — for Claude
OPENAI_API_KEY=           # Optional — for ChatGPT
OLLAMA_BASE_URL=http://host.docker.internal:11434
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_LLM_MODEL=gemma4:latest
FRONTEND_URL=http://localhost:3000
```

## Database

- PostgreSQL 16 with asyncpg driver
- Alembic for migrations (`backend/alembic/versions/`)
- Current head: check with `docker compose exec backend alembic current`
- Key tables: users, presentations, presentation_inputs, presentation_plans, presentation_slides, llm_configs, prompt_configs, brand_profiles, template_collections, template_variations, guide_sections, guide_blocks

## Conventions

- **Backend**: All endpoints under `/api/`. Async SQLAlchemy — avoid lazy loads (use explicit selects). Build response dicts inline to avoid greenlet errors with `_to_response` helpers.
- **Frontend**: "use client" pages. `api` from `@/lib/api` for all HTTP calls (axios with JWT auto-refresh). Inline SVG icons — no external icon library. Tailwind classes only.
- **Git**: Commit messages describe the "what" and "why". Co-authored with Claude. Push to `main` branch.
- **Docker**: Backend rebuilds needed for Python changes. Frontend rebuilds needed for any `.tsx`/`.ts`/`.css` changes. Nginx restart needed for `nginx.conf` changes only.
- **No 404 spam**: Step pages check `usePipeline()` `has_*` flags before calling GET endpoints for data that might not exist yet.
- **Ollama endpoint**: Use `host.docker.internal:11434` (Docker Desktop). For Linux servers, users change to `172.17.0.1:11434` in the LLM settings UI.

## Testing Locally

1. `docker compose up -d` — starts all services
2. Open `http://localhost:8080/slide-generator/login`
3. Register a user, create a presentation
4. Configure Ollama with Gemma4 in Settings → LLM Configuration
5. Walk through the 5-step pipeline

## Known Issues

- `(trapped) error reading bcrypt version` in backend logs — harmless passlib/bcrypt compatibility warning, does not affect functionality
- WeasyPrint requires `pydyf==0.10.0` pin to avoid PDF generation crashes
