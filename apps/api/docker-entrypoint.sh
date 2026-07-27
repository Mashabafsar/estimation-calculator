#!/bin/sh
set -e

DB_HOST="${DB_HOST:-estimation-db}"
DB_PORT="${DB_PORT:-5432}"

echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
i=0
while [ "$i" -lt 60 ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "Database is reachable."
    break
  fi
  i=$((i + 1))
  echo "  attempt $i/60 — not ready yet"
  sleep 2
done

if ! nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
  echo "ERROR: cannot reach ${DB_HOST}:${DB_PORT}"
  echo "DATABASE_URL=${DATABASE_URL}"
  getent hosts "$DB_HOST" || true
  exit 1
fi

npx prisma migrate deploy
npx tsx prisma/seed.ts || echo "Seed skipped or failed (continuing)"
exec node dist/index.js
