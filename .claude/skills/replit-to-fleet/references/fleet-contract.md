# Fleet Control run contract

Fleet Control is a control plane for AI coding agents. A GitHub repo becomes a
**workspace**: coordinator, dev and QA agents each get a clone, and optionally k8s
delivery. The repo must carry a "run contract" that the collector's preflight checks
(`collector/preflight.py`) and that three launchers use. Read the fleet's real code rather
than trusting docs. It lives in the agent-fleet backend repo (`agent-fleet-backend`; in
this environment `find / -path "*agent-fleet-backend*/collector/fleet_template" -type d`).

## Contents
1. Files to add
2. fleet.conf for a scaffold app
3. How each launcher runs it (what must hold)
4. BASE_PATH (preview prefix) support
5. CI and why it can't install private packages yet
6. Verification
7. Registration (human step)

## 1. Files to add

Copy the template VERBATIM from `collector/fleet_template/`:

| Template path | Repo path | Mode |
|---|---|---|
| `bin/{run,start,stop,restart,reload}` | `bin/` | 755 |
| `bin/_common.sh` | `bin/` | 644 |
| `run` | `run` | 755 |
| `qa/{SUITES.md,SUITES.example.json,SEAM.md}` | `qa/` | |
| `CLAUDE.md` | `CLAUDE.md` (merge if the repo has one) | |
| `github/{deploy,manual-deploy}.yml` | `.github/workflows/` | |
| `gitignore` entries | append `.fleet/` and `*.log` to `.gitignore` | |

Plus `fleet.conf` (§2). Keep `.env` ignored and `.env.example` present.
Check that git kept the exec bits (`git ls-tree HEAD bin/run` → `100755`).

## 2. fleet.conf for a scaffold app

`assets/fleet.conf`:
```sh
NAME="<app-slug>"
PORT="5000"
HEALTH_PATH="/api/healthz"
INSTALL_CMD='cd "${FLEET_ROOT:-.}" && npm ci --no-audit --no-fund'
BUILD_CMD='cd "${FLEET_ROOT:-.}" && BASE_PATH="$BASE_PATH" npm run build && npm run db:push'
START_CMD='env PORT="$PORT" node --enable-source-maps "${FLEET_ROOT:-.}/apps/api/dist/index.mjs"'
RELOAD_CMD=''
```
Every rule behind it:
- **Single quotes** around anything with `$PORT`/`$BASE_PATH` (a required preflight
  check). Double quotes expand at source time, which gives the default PORT and an empty
  BASE_PATH.
- **`${FLEET_ROOT:-.}`**: `bin/run` runs commands from `bin/` with `FLEET_ROOT` set, while
  the tester runs them from the repo root with it unset. This form works in both.
- **`env PORT="$PORT" node …`**: `bin/run` does `eval "exec $START_CMD"`, and
  `exec PORT=… cmd` fails in bash (`exec: PORT=…: not found`). `env` works, satisfies the
  "honors $PORT" check, and execs node, so node keeps the pidfile's PID.
- **Run `node` directly, not `npm start`**: with npm the pidfile holds npm. `bin/stop`
  then kills npm, leaves node holding the port, and only an `lsof` fallback cleans up.
  Running `node` directly from the repo root works because of `apps/api/src/cwd.ts`.
- **`db:push` in BUILD_CMD**: the tester gives each QA run a fresh empty database and
  passes `DATABASE_URL` to both build and start.
- **`HEALTH_PATH` is app-relative**: the fleet adds BASE_PATH itself. Port 8000 is
  forbidden, and 5000 is fine.

## 3. Launchers

| Launcher | How | Environment |
|---|---|---|
| QA tester (`tester.py`) | sources fleet.conf in bash, runs each cmd via `/bin/sh -c` (dash) from the **repo root**, `start_new_session`, polls HEALTH_PATH ≤180s, `killpg` on teardown | App .env, then PORT, HOST=0.0.0.0, TEST_BASE_URL, DATABASE_URL (fresh `qa_<app>_<id>` db), `BASE_PATH=""` |
| "Run app" (`coordinator/deploy.py` → `./run` → `bin/run`) | `cd bin`, source `_common.sh`, eval install/build, `exec` START_CMD, pidfile `.fleet/app.pid`; readiness = port open | App .env, then PORT, `BASE_PATH=/direct/<agent>:<port>`, per-agent DATABASE_URL |
| Cluster (k8smgr/Helm) | image from `./Dockerfile` built by CI | PORT from deployPort; probes default `/` |

The commands have to be POSIX sh, because the tester uses dash, not bash.

## 4. BASE_PATH support

Fleet nginx (`web/nginx.conf`) forwards `/direct/<id>:<port>/…` to the app **with the
prefix intact**. A root-absolute request from that page (`/api/x`, `/assets/y`) is
routed back to the same app by `Referer` (`map $http_referer $direct_up`) with **no
prefix**, except fleet-owned paths (`/api/collector/`, `/api/svcmgr/`, `/api/k8smgr/`,
`/api/chainflow*/`, `/api/agent/…`, `/api/ws/…`, `/api/agentmgr/`). Check that the app
doesn't use any of those. So the app has to accept both forms:

1. **API**: strip the BASE_PATH prefix when present (see `assets/app.ts.example`,
   first middleware). Unprefixed requests pass through untouched.
2. **helmet `referrerPolicy: strict-origin-when-cross-origin`**: helmet's default
   `no-referrer` removes the Referer header the ingress routes by.
3. **Vite `base`** from BASE_PATH at build time (`assets/vite.config.ts`). The
   Replit-template router already uses `import.meta.env.BASE_URL`, so routes follow.
   BUILD_CMD passes `BASE_PATH="$BASE_PATH"` explicitly. `bin/run` exports it before
   building anyway, but the explicit form also satisfies the advisory check.
4. **Client `/api` calls**: `assets/base-path.ts` → `installApiBasePath()` in
   `main.tsx`. It wraps `window.fetch` so string URLs starting with `/api/` get the
   prefix. That covers hand-written `fetch` and the orval `custom-fetch` mutator
   together. Plain `<a href="/api/…">` downloads rely on Referer routing (point 2).

## 5. CI

`collector/delivery/ci_bootstrap.py` re-commits the two workflow files on every
provision and every preflight "Fix" whenever they differ from the template byte for
byte. So a customised `deploy.yml` gets reverted. The template passes **no build
secrets**, and GitHub Packages needs a token for every package, so the image build
can't `npm ci` the private runtimes. So:
- Commit the workflows verbatim.
- Make the Dockerfile secret optional (`--mount=type=secret,id=npm_token`, read with
  `2>/dev/null`), so it works once the template forwards one.
- Report it as a known gap: cluster images need the fleet template to pass a packages
  token as build secret `npm_token`. Agent, preview and QA runs aren't affected.

## 6. Verification

Do it on a **clean clone of the commit you'll push** (`git clone -q <repo> <tmp>`),
against fresh databases, on non-default ports:

1. **Preflight**: `scripts/fleet_preflight.py <backend> <repo>`. It needs 0 required
   failures, and all advisory checks should pass too.
2. **QA tester path**: `scripts/sim_fleet_tester.py <clone> 5099 <fresh-db-url> <app-env-file>`.
   Expect READY, `/` html, `/api/health` json, and the port free after teardown.
   Starting `node` from the repo root is the working-directory check: the API crashes
   if its data files aren't found.
3. **Run-app path, under a prefix**:
   ```bash
   node scripts/fleet_ingress.mjs 8088 &            # emulates the two nginx rules
   cd <clone> && env -u FLEET_ROOT <app env> PORT=5098 BASE_PATH=/direct/agent1:5098 \
     DATABASE_URL=<fresh-db-2> setsid ./run > run.log 2>&1 &
   ```
   - The pidfile PID has to be `node` and has to own the port:
     `ps -o comm= -p $(cat .fleet/app.pid)` and `fuser 5098/tcp`.
   - Then `node scripts/verify_prefix.mjs http://localhost:8088 agent1 5098 / <routes…>`
     (run from `apps/web`). Expect 0 issues, links under the prefix, and API calls
     "prefixed".
   - Then `./run stop`. It should print "stopped" with no "freeing port" line, and
     nothing should be left running.
4. Clean up the test databases, the clone and background processes.

## 7. Registration (human step)

In the fleet dashboard, click **Adopt** on the repo (`POST /workspaces/adopt`) and set:
- `deployPort` 5000;
- a coordinator, workers and testers;
- the App .env: the `.npmrc` token variable, `SESSION_SECRET`, `NODE_ENV=development` (for
  demo apps) and the optional integration keys.

The fleet's own GitHub token needs access to the repo's org. Leave this step to the
user; the repo must be pushed before it can be adopted.
