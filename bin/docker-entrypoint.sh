#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_USER="${DB_USER:-fixflow}"

# Wait for database to be ready
echo "Waiting for PostgreSQL at $DB_HOST..."
until pg_isready -h "$DB_HOST" -U "$DB_USER" -q; do
  echo "  PostgreSQL not ready — retrying in 2s..."
  sleep 2
done
echo "PostgreSQL is ready."

# Run migrations
bundle exec rails db:migrate

# Seed on first run if requested
if [ "${SEED_DB}" = "true" ]; then
  bundle exec rails db:seed
fi

# Create MinIO buckets
bundle exec rails fixflow:minio_setup 2>/dev/null || true

# Hand off to CMD
exec "$@"
