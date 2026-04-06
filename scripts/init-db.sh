#!/bin/bash
set -e

echo "⏳ Waiting for PostgreSQL to be ready..."

until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-kpmg_slides}" -d "${POSTGRES_DB:-slides_generator}" > /dev/null 2>&1; do
  echo "  PostgreSQL not ready yet, retrying in 2s..."
  sleep 2
done

echo "✅ PostgreSQL is ready."

echo "🔄 Running Alembic migrations..."
cd /app
alembic upgrade head

echo "🌱 Seeding system templates..."
python scripts/seed-templates.py || echo "⚠️  Seed script not found or failed — skipping."

echo "✅ Database initialization complete."
