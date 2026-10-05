---
name: replit-to-fleet
description: Migrate a Replit-built pnpm monorepo app (artifacts/api-server + artifacts/web-app + lib/db, lib/api-spec, @workspace/* packages, often with private GitHub Packages runtimes) onto the fleet-scaffold-v1 layout (npm workspaces, apps/api + apps/web + packages/*), make it boot outside Replit, and add the Fleet Control run contract (fleet.conf, bin/run, BASE_PATH preview support) so it can be adopted as a Fleet Control workspace. Use this whenever the user wants to port, migrate, convert or "move to the scaffold" a Replit app or any repo under girikrishna-hub / .repos, create a fleet-* repo from an existing app, make an app "work with fleet-control", or fix a migrated app that fails on a fresh database.
---

# Replit app → fleet-scaffold-v1 → Fleet Control workspace

This skill captures a migration that worked end to end for a large Replit app (CLMS). The work splits into three phases, each with a gate you have to
pass before starting the next. Most of the real effort goes into problems that only show up
when you **run** the app, so run it early and often, and always against an empty database.

Reference files (read the one for the phase you're in):
- `references/layout-mapping.md`: phase 1, where every file goes and the config for each package
- `references/runtime-fixes.md`: phase 2, a symptom → cause → fix catalogue and the verification loop
- `references/private-packages.md`: private GitHub Packages, the token, and version checks
- `references/fleet-contract.md`: phase 3, fleet.conf, the launchers, BASE_PATH, CI and verification

`assets/` holds working files from the CLMS migration to copy and adapt. `scripts/` holds
the checkers. Run them rather than re-deriving them.

## 0. Settle the inputs first

Ask for anything you can't find out yourself, and state the defaults you're using:

| Input | Default |
|---|---|
| Source repo path | required (e.g. `.repos/girikrishna-hub/<App>`) |
| Target repo `<org>/<name>` | ask for the org; name defaults to `fleet-<app>-v1` |
| Scaffold repo | `Qode-Fleet-Control/fleet-scaffold-v1` (this repo, if you're in it) |
| npm token | whatever variable the source `.npmrc` references (classic PAT, `read:packages`) |
| GitHub token for create/push | ask which env var (it needs Administration: write to create repos) |
| Primary web artifact | the only `kind = "web"` artifact, excluding `mockup-sandbox`; ask if there are several |

Before you change anything:
- Check the npm token with `scripts/check_versions.sh <source>`. Every pinned
  private version has to resolve.
- If versions are missing, stop and ask. Don't bump pins to whatever is available,
  because a major-version drift breaks at runtime in ways typecheck won't show.

Tokens: read them from `.env` into env vars inside the command, and never echo them.
Scan staged files for real token values before every commit.

## 1. Move the code onto the scaffold

1. **Create the target repo.** You can't fork a repo into the org that already owns it, so
   create an empty private repo, clone the scaffold locally, set `origin` to the new repo
   and push `main`. The new repo then starts from the scaffold's history.
2. **Survey the source.** Read `.replit`, every `artifacts/*/.replit-artifact/artifact.toml`,
   the root `package.json` (runtime deps often live only there), `pnpm-workspace.yaml`
   (the `catalog:`), `lib/*`, and the files the API reads through `process.cwd()`.
3. Delete the scaffold's notes demo, copy the code over, rename `@workspace/*` →
   `@scaffold/*`, and rewrite the manifests. Follow `references/layout-mapping.md`.
4. **Private packages.** Keep the source's `.npmrc` scopes, token variable and exact pins
   (`references/private-packages.md`).
5. Run `npm install`, then `npm run typecheck`.

**Gate 1:** install succeeds and all workspaces typecheck with 0 errors.

## 2. Make it run outside Replit

Start Postgres (Docker, and let Docker pick the host port), then:
- `npm run db:push` on a fresh database;
- boot the API;
- fix what breaks, using `references/runtime-fixes.md`.

Expect these on nearly every Replit app:
- the working directory, `PORT` and `NODE_ENV` assumptions baked into Replit scripts;
- DDL races on the first boot against an empty database (`scripts/memoize_ddl.py --scan`);
- Drizzle schema drift against `ON CONFLICT` targets (`scripts/audit_on_conflict.py`);
- pages that flood the API when a demo-only endpoint 404s.

When you fix app code, change as little as possible and leave a short comment explaining
why. The goal is "runs the same as it did on Replit", not a refactor.

**Gate 2:**
- typecheck and tests pass;
- every parameterless GET returns something other than 5xx;
- the production build serves web and API from one port;
- `scripts/crawl_pages.mjs` finds 0 page errors, 0 5xx and 0 request storms across every
  route;
- one real flow per runtime works;
- `docker compose up --build` works from an empty volume.

Then commit and push. The commit message says what moved, what was fixed and why, and
what was deliberately left out.

## 3. Add the Fleet Control run contract

Follow `references/fleet-contract.md`:
- copy the template files verbatim;
- write `fleet.conf` (start from `assets/fleet.conf`, including its `DOCKER_*` block) and
  `compose.yaml` (start from `assets/compose.yaml`) — the fleet runs the app as containers;
- make the API independent of its working directory (`assets/cwd.ts`, imported first);
- add BASE_PATH support: the API strips the prefix, the helmet referrer policy keeps the
  Referer header, Vite `base` comes from BASE_PATH, and `assets/base-path.ts` prefixes
  client `/api` calls;
- keep the CI workflows verbatim, and make the Docker npm secret optional.

**Gate 3.** Commit locally, then on a clean clone of that commit:
- `scripts/fleet_preflight.py` reports 0 required failures;
- `scripts/sim_fleet_tester.py` gets READY and a clean teardown;
- `./run` under `BASE_PATH=/direct/agent1:<port>`, behind `scripts/fleet_ingress.mjs`,
  passes `scripts/verify_prefix.mjs` with 0 issues;
- the pidfile holds the `node` process;
- `./run stop` leaves nothing running.

Then push.

## Environment notes (this devcontainer)

- **Git over HTTPS:** global gitconfig rewrites `https://github.com/` to SSH, which uses
  an identity without access to these orgs. Push with the token for that one command only:
  `GIT_CONFIG_GLOBAL=/dev/null git -c credential.helper= -c credential.helper='!f() { echo username=x-access-token; echo password=$TOKEN; }; f' push origin main`.
  Don't change the user's gitconfig. `git fetch` fails silently the same way, so confirm
  the remote state with `gh api repos/<org>/<repo>/commits/main`.
- **Docker pulls:** the credential helper fails on pulls. Use
  `DOCKER_CONFIG=<tmp dir with {} config.json and a cli-plugins symlink>` for
  build/compose, and drop the `# syntax=` Dockerfile line.
- **Stopping servers:** kill by port (`fuser -k <port>/tcp`), not by pid. `npx`/`npm`
  wrappers leave the real server running, and never `pkill -f` a pattern that matches
  your own shell.
- Use throwaway compose project names and override host ports, and tear everything down
  afterwards (`down -v --rmi local`).

## Final report

Tell the user:
- the target repo URL and the commit(s) pushed;
- what was verified and how, with the numbers (pages crawled, checks passed);
- every change to app behaviour and why (DDL once, constraints added, NODE_ENV, rate
  limit, BASE_PATH);
- what was left out (docs, assets, validators);
- known gaps (the CI build secret, optional integrations);
- the human steps left: fleet **Adopt** with deployPort 5000, and the App .env values.
