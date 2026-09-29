# Runtime fixes: making a Replit app boot outside Replit

Replit apps have only ever run against ONE long-lived database, with Replit's env vars,
started by Replit's scripts. Moving them surfaces failures that never showed there. Each
entry: symptom → cause → fix. Fix the cause; don't paper over the symptom.

## Contents
- Boot failures (API never listens)
- First-boot-on-empty-database failures
- Behaviour that depends on NODE_ENV
- Request storms / page-level issues
- Verification loop

## Boot failures

**`does not provide an export named 'X'` from a private runtime package**
Cause: a newer major version than the source pinned (the registry only had newer
versions, or a `^` range floated). Fix: install the exact source version
(`scripts/check_versions.sh`). If it isn't published, STOP and ask: porting to a new major
is a rewrite. In CLMS, one runtime's 2.0 release removed a provider class that every
journey used. The code mostly hid it behind `as never`/`any` casts, so `tsc` flagged only a
few files.
Typecheck passing is not evidence of runtime compatibility when the code casts heavily.

**`<X> Factory artifact identity drift` / content hash verification failed**
Cause: a hashed artifact (e.g. `jab/<journey>/…json`) was modified — usually by a bulk
`sed` scope rename. Fix: restore from source byte-for-byte; diff the whole dir:
`diff -rq apps/api/jab <source>/artifacts/api-server/jab`.

**`PORT environment variable is required`** — Replit templates throw. Default to 5000.

**`DATABASE_URL must be set`** at import — scaffold's db `index.ts` defaults instead.

## First boot on an empty database

Always test against a FRESH database (`drop database … with (force)`, `db:push`, boot).

**`duplicate key value violates unique constraint "pg_type_typname_nsp_index"`**
Cause: two concurrent `CREATE TABLE IF NOT EXISTS` for the same table (parallel
initialisers at startup, or a request + a background worker). Harmless once tables exist,
which is why Replit never saw it. Fix: run each DDL block once per process with a shared
promise.
- `scripts/memoize_ddl.py --scan apps/api/src` lists exported `ensure*Schema()` functions
  with DDL and no memoisation; `scripts/memoize_ddl.py <file> <fn>…` wraps them.
- The scan does NOT catch private helpers inside an otherwise-memoised runtime — e.g. an
  IAM module whose `ensureSchema()` is called by two runtimes started with `Promise.all`.
  Look at every `Promise.all` in startup code and every function called from more than one
  `getXRuntime()`; wrap those the same way by hand.
- DDL inline in a request handler (e.g. inside `createSession`) races only on concurrent
  first use; note it rather than refactor.

**`there is no unique or exclusion constraint matching the ON CONFLICT specification`**
Cause: schema drift. The runtime DDL declares `UNIQUE (a, b)` but the Drizzle schema does
not; `db:push` created the table first so the runtime `CREATE TABLE IF NOT EXISTS` was
skipped. Fix: add the constraint to the Drizzle table, named as Postgres names inline
constraints so runtime-created and push-created databases converge:
```ts
unique("<table>_<col1>_<col2>_key").on(table.col1, table.col2),
```
Find them all: boot once, exercise the app, then
`scripts/audit_on_conflict.py apps/api/src "$DATABASE_URL"`; re-run after exercising pages
that create tables lazily.

**Masked DDL errors** — some initialisers `.catch(() => { throw new XError("schema not
installed", 503) })`. A 503 "schema is not installed" on first use is usually the race
above, not a missing migration.

## NODE_ENV

Replit's API dev script is `export NODE_ENV=development && build && start`, so demo-only
behaviour was always on. Grep `NODE_ENV` in apps/api/src and classify:
- `!== "development"` → feature exists ONLY in development (prototype persona sessions,
  resets). Without it those endpoints 404.
- `=== "production"` → disabled in production, or `secure` cookies.
- logger pretty-printing.
Set `NODE_ENV=development` in `apps/api` `dev`, and `${NODE_ENV:-development}` in compose,
for apps that describe themselves as prototypes/demos. Say so in the report — it is a
product decision for real production.

## Request storms

A page that calls a mutation in `useEffect` whenever the context query has no actor will
loop forever when the mutation fails (e.g. the NODE_ENV 404 above) — thousands of
requests, then the scaffold rate limiter returns 429s everywhere and every later page
looks broken. `scripts/crawl_pages.mjs` reports `REQUEST STORM`. Fix the cause (usually
NODE_ENV); keep the rate-limit ceiling generous (`RATE_LIMIT_MAX`, default 5000) since
demo directors poll.

Also note: the source app had no rate limiter at all; the scaffold's 300/15min default is
too low for these apps.

## Optional integrations (expected to be "unavailable")

`AI_INTEGRATIONS_OPENAI_*` (Replit AI proxy), `PRIVATE_OBJECT_DIR` (Replit object storage
via GCS), `@replit/connectors-sdk`. Endpoints return 503 "unavailable" without them; the
rest of the app works. List them in `.env.example`, commented.

## Verification loop

1. `npm run typecheck`, `npm test`.
2. Fresh DB → `npm run db:push` twice (second run must not touch non-schema tables).
3. Boot the API (`npx tsx src/index.ts` from apps/api, or the built bundle). Kill leftovers
   by PORT (`fuser -k 5000/tcp`), not by the `npx` PID — `npx` leaves `tsx` holding the
   port and the next start dies with EADDRINUSE while the old server keeps answering.
4. curl every parameterless GET route (`grep -hoE 'router\.get\(\s*["'\''`][^"'\''`]+'`, drop
   ones with `:`) — expect only 200/400/401/403, never 5xx.
5. Production build, serve web + API from one process, `scripts/crawl_pages.mjs` over every
   route in App.tsx: 0 page errors, 0 5xx, 0 storms.
6. Exercise at least one real flow per runtime (start a journey, create a persona session).
7. `docker compose up --build` from an empty volume under a throwaway project name.
