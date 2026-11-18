FROM node:22-alpine

WORKDIR /app

# Never run as root: build and run as the image's own `node` user (uid 1000). The UID is
# numeric so Kubernetes can verify `runAsNonRoot` without reading /etc/passwd.
RUN chown 1000:1000 /app
USER 1000:1000

# Install dependencies first (better layer caching). Copy every workspace manifest.
# Private packages come from GitHub Packages; the token is a build secret
# (never written to a layer): `GITHUB_TOKEN=... docker compose build`. Use the
# variable name the repo's .npmrc references.
# Every file is named: a glob, or a copy of the whole folder, can carry a file that was never
# meant for the image (a .env, a key) into a layer. The code scan flags both (docker:S6470).
# Drop a name the migrated repo does not have (no private packages means no .npmrc).
COPY --chown=1000:1000 package.json package-lock.json .npmrc ./
COPY --chown=1000:1000 packages/shared/package.json packages/shared/
COPY --chown=1000:1000 packages/db/package.json packages/db/
COPY --chown=1000:1000 packages/api-spec/package.json packages/api-spec/
COPY --chown=1000:1000 packages/api-zod/package.json packages/api-zod/
COPY --chown=1000:1000 packages/api-client-react/package.json packages/api-client-react/
COPY --chown=1000:1000 apps/api/package.json apps/api/
COPY --chown=1000:1000 apps/web/package.json apps/web/
# uid=1000: a build secret is root-only (0400) by default, and the install runs as `node`.
RUN --mount=type=secret,id=npm_token,uid=1000 \
    GITHUB_TOKEN="$(cat /run/secrets/npm_token 2>/dev/null)" npm ci --no-audit --no-fund

# Build web (dist/) and api (dist/index.mjs). Only what the build and the running app read
# is copied. Add a COPY line for any other top-level file or folder the migrated app needs.
COPY --chown=1000:1000 tsconfig.base.json ./
COPY --chown=1000:1000 packages ./packages
COPY --chown=1000:1000 apps ./apps
# The entrypoint stays root's and read-only to the app's user (no --chown): what starts
# the container cannot be rewritten from inside it.
COPY --chmod=755 docker-entrypoint.sh ./
RUN npm run build

EXPOSE 5000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
