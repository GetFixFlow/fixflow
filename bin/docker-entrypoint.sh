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

# Load demo data if requested. Never fatal: once a real company exists this is
# refused on purpose, and the container must still start.
if [ "${SEED_DB}" = "true" ]; then
  echo "SEED_DB=true: loading demo data (accounts use a well-known password)."
  CONFIRM=yes bundle exec rails fixflow:demo_data || echo "Demo data was not loaded."
fi

# Create MinIO buckets
bundle exec rails fixflow:minio_setup 2>/dev/null || true

# Hand off to CMD
exec "$@"
