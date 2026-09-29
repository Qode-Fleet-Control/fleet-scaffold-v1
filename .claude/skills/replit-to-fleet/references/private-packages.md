# Private npm packages (GitHub Packages)

Many Replit apps depend on private runtime packages served from GitHub Packages
(`npm.pkg.github.com`). The source repo's `.npmrc` lists which scopes come from there:

```
@<scope>:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## What to carry over

- **Keep the scopes and the exact pinned versions from the source.** Don't rename
  packages, and don't loosen pins to `^` ranges.
- **Keep the token variable** the source `.npmrc` uses (Replit apps use `GITHUB_TOKEN`),
  and use that same name for the Docker build secret, the compose file, the fleet App .env
  and the README.
  Inside Fleet Control agents, `GITHUB_TOKEN` is already set to the fleet's own PAT, so
  that token must be able to read the packages, or the App .env must override it.
- **Drop pnpm-only lines** from `.npmrc`: `auto-install-peers`,
  `ignore-workspace-root-check` and `strict-peer-dependencies`.
- **Never commit a literal token.**

## The token

- GitHub Packages needs a token for **every** package, public or private, and only
  accepts **classic** PATs with the `read:packages` scope. A fine-grained PAT always gets
  `403`, whatever permissions it has.
- The token's account must be able to read packages in every private scope (org
  membership, or per-package access under Package settings → Manage access). If the
  orgs use SAML SSO, the token also has to be authorised for them.
- To tell the failures apart:
  - `401`: the token is invalid or expired.
  - `403 permission_denied: read_package`: the account can't see the package.
  - `404`: the package or version doesn't exist.

## Check before installing

Run `scripts/check_versions.sh <repo>` before `npm install`. It reads the private scopes
from `<repo>/.npmrc`, collects every dependency in those scopes from the root, `apps/*`
and `packages/*` manifests, and checks that the exact pinned version exists in the
registry.

If a version is missing, stop and ask the user to publish it, or ask whether to move to
a newer version. Moving to a new **major** version is porting work, not part of the
migration: typecheck can pass while the code breaks at runtime, especially where it
casts with `as never` or `any`.

## Hashed artifacts

Some apps verify data files by content hash at startup (for example the `jab/` bundles,
or any directory with a `manifest.json`). Bulk find-and-replace across the repo must
skip them. Afterwards, diff them against the source: they must be byte-identical.
