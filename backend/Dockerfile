# --- Build stage ---
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Prisma's engine-detection script shells out to `openssl version` to pick
# the right query-engine binary for this OS/OpenSSL combination. The slim
# base image doesn't include the openssl CLI, so without this, detection
# silently fails and Prisma falls back to a hardcoded guess that's wrong
# for Debian Bookworm (which ships OpenSSL 3.0, not the 1.1.x Prisma
# defaults to) — that mismatch is what caused the container to crash at
# startup with "libssl.so.1.1: cannot open shared object file". The
# explicit `binaryTargets` in schema.prisma is the primary fix; this is
# defense-in-depth so detection is also correct if that ever changes.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production stage ---
FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production

# See the matching comment in the build stage above — required both for
# Prisma's own `prisma generate` below to detect the OpenSSL version
# correctly, and for the resulting query-engine binary to actually find
# libssl.so.3 at runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# Run as a non-root, dedicated user rather than the image's default root —
# limits blast radius if the process is ever compromised (e.g. via a
# dependency RCE), since it then can't write outside its own directories
# or install/modify system packages.
RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /bin/false --create-home squadlink \
  && mkdir -p /app/uploads \
  && chown -R squadlink:nodejs /app

USER squadlink

EXPOSE 3000

# Liveness/readiness probe for orchestrators (Docker Compose healthcheck,
# Kubernetes, etc.) — hits the app's own /api/v1/health endpoint rather
# than assuming the process being alive means it's actually serving.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/v1/health',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# `node` run directly as PID 1 does not forward signals (SIGTERM) to child
# processes and won't reap zombies; run this image with `docker run --init`
# (or an orchestrator that does the equivalent) so shutdown/restarts are
# clean. See docs/security/deployment.md.
CMD ["node", "dist/main.js"]
