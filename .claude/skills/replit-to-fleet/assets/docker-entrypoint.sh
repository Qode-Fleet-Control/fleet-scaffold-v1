#!/bin/sh
set -e

# Sync the Drizzle schema and apply the CLMS SQL files, then start the API
# (which also serves web/dist). Both steps are idempotent.
# No database, no app: say so plainly instead of drizzle-kit's "url: ''".
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set — this app needs a Postgres database." >&2
  echo "Deployed (beta/production): Fleet Control -> Deploy -> the environment row -> Database needed -> our database or your own." >&2
  echo "Dev preview: the fleet supplies the workspace database itself; seeing this there means it could not be provisioned." >&2
  exit 1
fi

echo "Applying database schema…"
npm run db:push

echo "Starting API on :${PORT:-5000}"
cd /app/apps/api
exec node --enable-source-maps dist/index.mjs
