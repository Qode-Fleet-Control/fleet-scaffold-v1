#!/bin/sh
set -e

# Sync the schema to the database when there is one, then start the API (which also serves
# web/dist). Swap `db:push` for `db:migrate` once you commit generated migrations.
# The database is optional: an app that stores no data runs without DATABASE_URL. An app that
# does depends on @scaffold/db in apps/api/package.json, and Devfab then requires DATABASE_URL
# before it ships, so it never reaches this point without one.
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Applying database schema…"
  npm run db:push
else
  echo "No DATABASE_URL: starting without a database."
fi

echo "Starting API on :${PORT:-5000}"
cd /app/apps/api
exec node dist/index.cjs
