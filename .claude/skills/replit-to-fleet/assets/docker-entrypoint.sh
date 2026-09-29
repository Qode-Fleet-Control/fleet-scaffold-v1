#!/bin/sh
set -e

# Sync the Drizzle schema and apply the CLMS SQL files, then start the API
# (which also serves web/dist). Both steps are idempotent.
echo "Applying database schema…"
npm run db:push

echo "Starting API on :${PORT:-5000}"
cd /app/apps/api
exec node --enable-source-maps dist/index.mjs
