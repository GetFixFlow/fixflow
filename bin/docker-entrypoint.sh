#!/bin/sh
set -e

# Check the settings first, so a mistake stops the start with a plain message. Set SKIP_CONFIG_CHECK=true to skip this.
if [ "${SKIP_CONFIG_CHECK}" != "true" ]; then
  bundle exec rails "fixflow:check_config[static]"
fi

DB_HOST="${DB_HOST:-db}"
DB_USER="${DB_USER:-fixflow}"

# Wait for the database to be ready, for two minutes at most, so a wrong address ends in a message instead of waiting forever.
echo "Waiting for PostgreSQL..."
tries=0
until { if [ -n "${DATABASE_URL}" ]; then pg_isready -d "${DATABASE_URL}" -q; else pg_isready -h "$DB_HOST" -U "$DB_USER" -q; fi; }; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "PostgreSQL did not answer after 2 minutes. Check DATABASE_URL (or DB_HOST and DB_USER) and that the database is running." >&2
    exit 1
  fi
  echo "  PostgreSQL not ready — retrying in 2s..."
  sleep 2
done
echo "PostgreSQL is ready."

# With the services answering, check the rest (Redis, the mail server) before anything is changed.
if [ "${SKIP_CONFIG_CHECK}" != "true" ]; then
  bundle exec rails fixflow:check_config
  # Tell the server it need not check again (and print the same warnings twice).
  export FIXFLOW_CONFIG_CHECKED=true
fi

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
