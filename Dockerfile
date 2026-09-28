FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching). Copy every workspace manifest.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/api-spec/package.json packages/api-spec/
COPY packages/api-zod/package.json packages/api-zod/
COPY packages/api-client-react/package.json packages/api-client-react/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund

# Build web (dist/) and api (dist/index.cjs)
COPY . .
RUN npm run build && chmod +x docker-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
