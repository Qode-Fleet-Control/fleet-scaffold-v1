#!/bin/sh
set -e

# Sync the schema to the database, then start the API (which also serves web/dist).
# Swap `db:push` for `db:migrate` once you commit generated migrations.
echo "Applying database schema…"
npm run db:push

echo "Starting API on :${PORT:-5000}"
cd /app/apps/api
exec node dist/index.cjs
