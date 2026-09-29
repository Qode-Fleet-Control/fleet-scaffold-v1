FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching). Copy every workspace manifest.
# Private packages come from GitHub Packages; the token is a build secret
# (never written to a layer): `GITHUB_TOKEN=... docker compose build`. Use the
# variable name the repo's .npmrc references.
COPY package.json package-lock.json* .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/api-spec/package.json packages/api-spec/
COPY packages/api-zod/package.json packages/api-zod/
COPY packages/api-client-react/package.json packages/api-client-react/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=secret,id=npm_token \
    GITHUB_TOKEN="$(cat /run/secrets/npm_token 2>/dev/null)" npm ci --no-audit --no-fund

# Build web (dist/) and api (dist/index.mjs)
COPY . .
RUN npm run build && chmod +x docker-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
