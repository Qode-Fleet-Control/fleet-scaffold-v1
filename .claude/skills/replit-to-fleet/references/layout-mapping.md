# Layout mapping: Replit pnpm workspace → fleet-scaffold-v1

## Contents
1. Recognising the source shape
2. Directory mapping
3. Package manifests (pnpm → npm workspaces)
4. API (apps/api)
5. Web (apps/web)
6. Database (packages/db)
7. Codegen packages
8. TypeScript settings
9. Root files, Docker
10. What to leave behind

## 1. Recognising the source shape

Replit "PNPM_WORKSPACE" apps look like this (check `.replit` → `[agent] stack = "PNPM_WORKSPACE"`):

```
artifacts/<name>/            deployable units; each has .replit-artifact/artifact.toml
  kind = "api"               → the Express server (usually artifacts/api-server)
  kind = "web"               → a Vite React SPA
lib/db  lib/api-spec  lib/api-zod  lib/api-client-react   shared libs (@workspace/*)
scripts/                     dev scripts (hello.ts, validate-*.ts)
pnpm-workspace.yaml          packages list + `catalog:` versions + overrides
.replit  replit.md  main.py  pyproject.toml  uv.lock  attached_assets/  docs/ ...
```

Read every `artifact.toml` first: `kind`, `localPort`, `paths`, dev/prod commands. Also
read the root `package.json` `dependencies` — Replit apps often declare runtime deps
ONLY at the root (hoisting made them work), so the real imports must be recomputed per
package (see §3).

Several `kind = "web"` artifacts: ask which is the product. `mockup-sandbox` is Replit's
component-preview tool — not part of the app.

## 2. Directory mapping

| Source | Target |
|---|---|
| `artifacts/api-server/src/{app,index}.ts` | `apps/api/src/` (merge, see §4) |
| `artifacts/api-server/src/{lib,routes,middlewares}` | `apps/api/src/` |
| `artifacts/api-server/build.mjs` | `apps/api/build.mjs` (keep — see §4) |
| any runtime data dir the API reads via `process.cwd()` (e.g. `jab/`) | `apps/api/<same>` |
| `artifacts/<web>/src/.`, `public/`, `index.html`, `components.json` | `apps/web/` |
| `lib/db/src/schema/*` | `packages/db/src/schema/` (scaffold has a single `schema.ts` — replace it) |
| `lib/db/migrations/*.sql` | `packages/db/sql/` + `assets/apply-sql.ts` → `packages/db/scripts/` |
| `lib/api-spec/openapi.yaml` | `packages/api-spec/` |
| `lib/api-zod/src/.` | `packages/api-zod/src/` |
| `lib/api-client-react/src/.` (incl. `custom-fetch.ts`) | `packages/api-client-react/src/` |

Delete the scaffold demo first: `apps/api/src/routes/notes.ts`, `app.test.ts`,
`apps/web/src/pages/NotesPage.tsx`, `apps/web/e2e/notes.spec.ts`, `apps/web/src/lib/api.ts`,
the notes schema, and the scaffold's generated api files. Keep `packages/shared` (replace the
notes schema with something small, e.g. a `HealthSchema` the API's `/api/health` uses).

Rename imports: `@workspace/(db|api-zod|api-client-react)` → `@scaffold/\1` in all
`*.ts`/`*.tsx`. Grep afterwards for `@workspace`, `artifacts/`, `lib/db` — hits inside URL
route strings are false positives. Also rewrite path candidates like
`resolve(process.cwd(), "artifacts/api-server/jab/…")` → `"apps/api/jab/…"`.

## 3. Package manifests

- pnpm `catalog:` → the concrete range from `pnpm-workspace.yaml`'s `catalog:` block.
- `workspace:*` → `"*"` (npm workspaces).
- Recompute each package's real imports and add anything only declared at the root:
  ```bash
  grep -rhoE "(from |import\()['\"][^'\"./][^'\"]*['\"]" apps/api/src | sed -E "s/.*['\"]([^'\"]+)['\"]/\1/" \
    | sed -E 's#^(@[^/]+/[^/]+|[^@/][^/]*).*#\1#' | grep -v '^node:' | sort -u
  ```
  Take pinned versions for those from the ROOT package.json / pnpm-lock.yaml.
- Private runtimes (the scopes the source `.npmrc` sends to GitHub Packages): keep the
  EXACT pins from the source; see `private-packages.md`.
- Drop `@replit/*` vite plugins, `preinstall` pnpm guards, `expo`-motivated exact pins
  (react `19.1.0` → `^19.1.0` is fine).
- Scaffold root has `"overrides": {"vite": "^6.0.0"}` (vitest 2). `@vitejs/plugin-react` ^5
  and `@tailwindcss/vite` ^4.1 both work with vite 6 — keep the override.
- Add scaffold's API deps the source lacks: `helmet`, `express-rate-limit`, `supertest`,
  `vitest`, `tsx`.
- Delete the scaffold's stale `package-lock.json` and regenerate with `npm install`.

## 4. API (apps/api)

- **Build: keep the source's `build.mjs`** (ESM bundle → `dist/index.mjs`, pino plugin,
  createRequire banner). The scaffold's CJS esbuild one-liner breaks on top-level `await`
  (grep `^await \|^const .* = await ` in src) and on pino workers. Scripts:
  `"build": "node ./build.mjs"`, `"start": "node --enable-source-maps dist/index.mjs"`,
  `"dev": "NODE_ENV=development tsx watch src/index.ts"` (NODE_ENV: see runtime-fixes.md).
- **app.ts**: use `assets/app.ts.example` as the shape — `createApp()` factory (scaffold
  convention, testable with supertest) containing:
  BASE_PATH-strip middleware → helmet (CSP off, `referrerPolicy:
  strict-origin-when-cross-origin`) → cors → the source's pino-http config → json/urlencoded
  → cookieParser(SESSION_SECRET) → rate limit on `/api` (generous default, `RATE_LIMIT_MAX`,
  skip health) → `/api/health` → `app.use("/api", router)` → serve `../web/dist` with SPA
  fallback, else a JSON `/`.
  The source's `app.get("/")` JSON handler must NOT shadow the SPA in production.
- **index.ts**: `import "./cwd"` FIRST (assets/cwd.ts), `PORT` defaults to 5000 instead of
  throwing, keep every startup initialiser and background worker the source starts.
  `assets/index.ts.example` is CLMS's version — the worker imports are app-specific.
- Keep both `/api/health` (scaffold) and the source's `/api/healthz` route.
- Replace the scaffold's `app.test.ts` with a supertest smoke test of `/api/health` —
  `vitest run` exits 1 when a package has no tests.

## 5. Web (apps/web)

- `vite.config.ts`: `assets/vite.config.ts` — scaffold config (port 5173, `/api` proxy →
  :5000, vitest block) plus `base` from `BASE_PATH`, `dedupe: ["react","react-dom"]`.
  Remove Replit's required `PORT`/`BASE_PATH` throws and the `@assets` alias if nothing
  imports `@assets` (grep first; if something does, copy only those files).
- `outDir` becomes the scaffold default `dist/` (the API serves `../web/dist`), not
  Replit's `dist/public`.
- `src/main.tsx`: call `installApiBasePath()` from `assets/base-path.ts`.
- Router base: Replit templates already use `import.meta.env.BASE_URL` for wouter's base —
  verify; add it if missing.
- `index.html`: drop "built on Replit" meta copy.
- Keep the scaffold's `src/test/setup.ts`; the source's shadcn `button.tsx` satisfies the
  scaffold's `button.test.tsx`. Replace `e2e/notes.spec.ts` with a small smoke spec.

## 6. Database (packages/db)

- `package.json` exports `"./schema": "./src/schema/index.ts"`; scripts:
  `push: drizzle-kit push`, `apply-sql: tsx scripts/apply-sql.ts`,
  `generate`, `migrate`, `typecheck`.
- `drizzle.config.ts` = `assets/drizzle.config.ts`: **`tablesFilter` limited to the
  schema's own tables**. Replit apps also create tables from hand-written SQL and at
  runtime; an unfiltered `drizzle-kit push` offers to DROP them (and prompts, which hangs
  non-interactive boots).
- `src/index.ts`: scaffold style (Pool with a default local URL) instead of throwing when
  `DATABASE_URL` is missing.
- Root `db:push` = `npm run push --workspace @scaffold/db && npm run apply-sql --workspace @scaffold/db`.
  `apply-sql.ts` records applied files in `_sql_migrations`, so it is idempotent.

## 7. Codegen packages

Copy generated sources verbatim. Adapt `orval.config.ts` paths (`lib/` → `packages/`,
`__dirname` → `fileURLToPath(import.meta.url)`), keep the source's mutator
(`custom-fetch.ts`) and zod coercion settings. You don't need to rerun codegen to make the
app run — only if you change `openapi.yaml`.

## 8. TypeScript settings

Scaffold `tsconfig.base.json` is full `strict` + `noUnused*`. Replit code was written
against looser settings (`strictFunctionTypes: false`, `noUnusedLocals: false`). Relax
per package (apps/api, apps/web) with a comment rather than weakening the base:
```json
"strictFunctionTypes": false, "noUnusedLocals": false, "noUnusedParameters": false
```
Add `"node"` to web `types` if the source uses `process.env` in vite config. Target: every
workspace passes `npm run typecheck` with zero errors.

## 9. Root files, Docker

- Root `package.json`: `name`, `"engines": {"node": ">=22"}` if Replit used nodejs-24 or any
  private runtime requires >=22.
- `.npmrc`: the source's registry lines and `_authToken=${…}` variable, unchanged
  (private-packages.md). Never a literal token.
- `.env.example`: DATABASE_URL (db name = app), PORT=5000, SESSION_SECRET, NODE_ENV,
  the `.npmrc` token variable, plus every `process.env.X` the API reads (grep), optional ones
  commented.
- Docker: `assets/Dockerfile` (node:22-alpine, token as BuildKit secret `npm_token`, no
  `# syntax=` line), `assets/docker-entrypoint.sh` (db:push then `node dist/index.mjs`),
  `assets/docker-compose.yml` (secret from env, `NODE_ENV: ${NODE_ENV:-development}`).
  Rename the DB (`POSTGRES_DB`) to the app's name.
- README: rewrite title/Layout/Prerequisites/Setup for the app; add Environment table and a
  Fleet Control section.

## 10. What to leave behind

docs/, reports/, screenshots/, attached_assets/, backups/, `.agents/`, `.replit`,
`.replitignore`, `replit.md`, `main.py`, `pyproject.toml`, `uv.lock`, `mockup-sandbox`,
`scripts/` (hello.ts + validators), per-journey `validate:*` npm scripts and
`artifacts/api-server/scripts/`. The validators are the app's own acceptance checks but
hard-code the old layout — list them in the final report as not migrated.
