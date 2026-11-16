FROM node:20-alpine

WORKDIR /app

# Never run as root: build and run as the image's own `node` user (uid 1000). The UID is
# numeric so Kubernetes can verify `runAsNonRoot` without reading /etc/passwd.
RUN chown 1000:1000 /app
USER 1000:1000

# Install dependencies first (better layer caching). Copy every workspace manifest.
COPY --chown=1000:1000 package.json package-lock.json* ./
COPY --chown=1000:1000 packages/shared/package.json packages/shared/
COPY --chown=1000:1000 packages/db/package.json packages/db/
COPY --chown=1000:1000 packages/api-spec/package.json packages/api-spec/
COPY --chown=1000:1000 packages/api-zod/package.json packages/api-zod/
COPY --chown=1000:1000 packages/api-client-react/package.json packages/api-client-react/
COPY --chown=1000:1000 apps/api/package.json apps/api/
COPY --chown=1000:1000 apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund

# Build web (dist/) and api (dist/index.cjs)
COPY --chown=1000:1000 . .
RUN npm run build && chmod +x docker-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
