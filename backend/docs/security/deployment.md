# Production deployment

## Network topology

```
Internet
   |
CDN / WAF (recommended: Cloudflare, AWS CloudFront+WAF, or similar)
   |
Reverse proxy / load balancer (TLS termination)
   |
NestJS API (this repo) — private network / VPC
   |
   +--> PostgreSQL (private network only, managed provider recommended)
   +--> Redis (private network only, managed provider recommended)
   +--> Object storage (S3 or equivalent, for uploads if UPLOAD_DRIVER=s3)
```

**Never** expose PostgreSQL (5432) or Redis (6379) directly to the
internet. `docker-compose.yml` in this repo binds both to `127.0.0.1`
for exactly this reason — it's meant for local/single-host use, not as a
production topology. In real production, use a managed Postgres/Redis
(RDS, Cloud SQL, Neon, Upstash, ElastiCache, etc.) reachable only from
the API's private network/VPC.

## Environment variables

Use `.env.production.example` as the template. Required for a real
deployment (validated at boot by `env.validation.ts`, and the app will
refuse to start if these are missing/invalid when `NODE_ENV=production`):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Least-privilege app user, not the Postgres superuser |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 32+ chars each, **must differ from each other** — generate with `openssl rand -base64 48` |
| `CORS_ORIGIN` | Comma-separated exact origins. Not `*`, not `localhost` |
| `APP_URL` / `API_URL` | Must be `https://` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` | Required — the app refuses to issue voice tokens without these in production (see H4 in `findings.md`) |
| `REDIS_URL` | Should include auth (`redis://:password@host:port`) |

Never commit a real `.env` file. `.gitignore` already excludes `.env*`
except the `*.example` templates.

## Build & deploy steps

```bash
# Backend
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy   # NOT `migrate dev` — see migration-strategy.md
npm run build
node dist/main.js           # or via the provided Dockerfile

# Frontend
npm ci
npm run build                # outputs static assets — deploy to a CDN/static host
```

Docker:

```bash
docker build -t squadlink-api ./backend
docker run --init -p 3000:3000 --env-file .env.production squadlink-api
```

`--init` matters: `node` run directly as PID 1 doesn't forward signals or
reap zombie processes correctly. The image now runs as a non-root user
(see M9 in `findings.md`) and exposes a `HEALTHCHECK` hitting
`/api/v1/health`.

## Migrations

Migrations must be applied with `prisma migrate deploy`, not `migrate
dev` (which can prompt interactively and is meant for local development).
Run migrations as a separate deploy step *before* the new application
version starts receiving traffic — see `docs/database/migration-strategy.md`
for the existing Phase 3 guidance on this, which is unchanged by Phase 4.

## Health checks

- `GET /api/v1/health/live` — liveness. Process-only, no dependency
  checks. Use for "should this instance be restarted" decisions.
- `GET /api/v1/health` — readiness. Checks the database connection and
  returns HTTP 503 (not 200) if it's unreachable. Use for "should this
  instance receive traffic" decisions (load balancer health checks,
  Docker `HEALTHCHECK`, k8s readiness probe).

## Monitoring (what to wire up; not built into this repo)

This phase does not ship a specific APM/monitoring vendor integration —
that's an infrastructure choice — but the application exposes what's
needed to wire one up:

- Structured logs via Nest's `Logger` (no secrets logged — see
  `findings.md` and `LoggingInterceptor`).
- `GET /api/v1/health` for uptime/readiness checks.
- Standard Node.js process metrics (CPU/memory/event-loop lag) are
  available via any standard Node APM agent (Prometheus `prom-client`,
  Datadog, New Relic, etc.) — none is bundled by default to avoid forcing
  a vendor choice.

Recommended minimum dashboard once deployed: request latency (p50/p95/p99)
and error rate per route, auth failure rate (a spike suggests credential
stuffing), Postgres/Redis connection pool saturation, WebSocket connection
count, and upload failure rate.

## Load testing — status: **NOT VERIFIED**

This phase's spec calls for testing at 100 / 500 / 1,000 concurrent
users. That was **not executed** — this sandbox has no network access to
a running Postgres/Redis/LiveKit instance (egress is restricted to a
package-registry allowlist; see the verification report), so there is
nothing to load-test against. To actually run this:

```bash
# From a machine with a real deployment target:
npm install -g autocannon
autocannon -c 100 -d 30 https://staging.example.com/api/v1/health
autocannon -c 100 -d 30 -m POST -H "Authorization: Bearer $TOKEN" \
  -b '{"content":"load test"}' https://staging.example.com/api/v1/messages/<conversationId>
# Repeat at -c 500 and -c 1000, watching Postgres connection count,
# Redis latency, and API p95 latency as you scale up.
```

Do not treat this project as validated for any particular concurrent-user
number until this has actually been run against a staging environment
that mirrors production sizing.
