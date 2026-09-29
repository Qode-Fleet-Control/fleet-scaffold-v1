# fullstack-ts-starter

A minimal, opinionated full-stack TypeScript starter. Same shape as the source
repos this was distilled from, with the rough edges fixed (npm workspaces, full
`strict`, real Drizzle migrations, no host lock-in).

## Stack

| Layer      | Choice                                                                        |
| ---------- | ----------------------------------------------------------------------------- |
| Language   | TypeScript (strict)                                                            |
| Frontend   | React 19 + Vite, wouter (routing), TanStack Query                             |
| UI         | Tailwind CSS 4 + shadcn/ui (Radix), lucide-react, recharts, framer-motion      |
| Forms      | react-hook-form + @hookform/resolvers (Zod)                                    |
| Backend    | Express 5 (helmet, cors, rate-limit, cookie-parser), esbuild bundle, pino      |
| Database   | PostgreSQL + Drizzle ORM (drizzle-kit migrations) + drizzle-zod                |
| Contract   | Zod in `@scaffold/shared`, plus OpenAPI → Orval codegen (Zod + React Query)    |
| Testing    | Vitest, Testing Library + jsdom (web), supertest (API), Playwright (e2e), axe  |
| Formatting | Prettier                                                                       |

## Layout

```
apps/
  api/               Express REST API              (@scaffold/api)
  web/               React SPA                     (@scaffold/web)
packages/
  shared/            Hand-written Zod contract     (@scaffold/shared)
  db/                Drizzle schema + client       (@scaffold/db)
  api-spec/          openapi.yaml + orval.config   (@scaffold/api-spec)
  api-zod/           generated Zod schemas         (@scaffold/api-zod)
  api-client-react/  generated React Query hooks   (@scaffold/api-client-react)
```

The demo app uses the hand-written `@scaffold/shared` + a typed `fetch` client
(`apps/web/src/lib/api.ts`), which mirrors how the source repos actually work.
The OpenAPI/Orval pipeline is wired and generates `@scaffold/api-zod` and
`@scaffold/api-client-react`; use those hooks instead if you prefer spec-first.

## Prerequisites

- Node.js >= 20
- A PostgreSQL database (local or remote)

## Setup

```bash
npm install
cp .env.example .env          # set DATABASE_URL
npm run db:generate           # create the SQL migration from the schema
npm run db:migrate            # apply it (or: npm run db:push for prototyping)
```

## Develop

```bash
npm run dev        # runs API (:5000) and web (:5173) together
# or, in two terminals:
npm run dev:api
npm run dev:web
```

The web dev server proxies `/api` to the API, so open http://localhost:5173.

## Build & run

```bash
npm run build      # builds web (dist/) then bundles the API
npm run start      # serves the API, which also serves web/dist if present
```

## Run everything with Docker (one command)

Brings up PostgreSQL and the app (API + built web) together. No local Node or
Postgres needed.

```bash
docker compose up --build
# open http://localhost:5000
```

The `app` container applies the schema (`db:push`) on startup, then serves the
API and the web bundle from a single Express process. Postgres data persists in
the `pgdata` volume. Stop with `docker compose down` (add `-v` to wipe the DB).

## Codegen (optional, spec-first)

```bash
npm run codegen     # regenerate api-zod + api-client-react from packages/api-spec/openapi.yaml
```

## Test / typecheck / format

```bash
npm run typecheck
npm run test                       # Vitest: API (supertest) + web (Testing Library)
npm run test:e2e --workspace @scaffold/web   # Playwright (installs a browser on first run)
npm run format                     # Prettier
```

## Claude Code skills

`.claude/skills/` ships project skills that Claude Code loads automatically in this repo
(and in repos created from it):

- **replit-to-fleet** — migrate a Replit pnpm-workspace app onto this scaffold, make it
  boot outside Replit, and add the Fleet Control run contract. Ask Claude to "migrate
  <path-to-replit-app> onto the scaffold".

## Adding to the contract

1. Add/extend a schema in `packages/shared/src/index.ts`.
2. Use it in an API route (`safeParse`) and in the web client (typed `api` calls).
3. Add a table in `packages/db/src/schema.ts`, then `npm run db:generate && npm run db:migrate`.
