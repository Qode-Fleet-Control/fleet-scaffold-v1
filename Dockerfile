FROM node:20-alpine

WORKDIR /app

# Never run as root: build and run as the image's own `node` user (uid 1000). The UID is
# numeric so Kubernetes can verify `runAsNonRoot` without reading /etc/passwd.
RUN chown 1000:1000 /app
USER 1000:1000

# Install dependencies first (better layer caching). Copy every workspace manifest.
# Every file is named: a glob, or a copy of the whole folder, can carry a file that was never
# meant for the image (a .env, a key) into a layer. The code scan flags both (docker:S6470).
COPY --chown=1000:1000 package.json package-lock.json ./
COPY --chown=1000:1000 packages/shared/package.json packages/shared/
COPY --chown=1000:1000 packages/db/package.json packages/db/
COPY --chown=1000:1000 packages/api-spec/package.json packages/api-spec/
COPY --chown=1000:1000 packages/api-zod/package.json packages/api-zod/
COPY --chown=1000:1000 packages/api-client-react/package.json packages/api-client-react/
COPY --chown=1000:1000 apps/api/package.json apps/api/
COPY --chown=1000:1000 apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund

# Build web (dist/) and api (dist/index.cjs). Only what the build and the running app read
# is copied. When you add a top-level file or folder the app needs, add its COPY line here.
COPY --chown=1000:1000 tsconfig.base.json ./
COPY --chown=1000:1000 packages ./packages
COPY --chown=1000:1000 apps ./apps
# The entrypoint stays root's and read-only to the app's user (no --chown): what starts
# the container cannot be rewritten from inside it.
COPY --chmod=755 docker-entrypoint.sh ./
RUN npm run build

EXPOSE 5000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
