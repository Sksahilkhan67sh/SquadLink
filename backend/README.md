# SquadLink — Backend (Phase 2)

Production-structured NestJS backend for SquadLink, integrating with the Phase 1
React frontend. Postgres schema via Prisma, Redis/LiveKit as integration hooks,
Socket.IO for realtime, JWT + 5 OAuth providers for auth.

## Stack

- NestJS 11 + TypeScript (strict null checks)
- PostgreSQL via Prisma ORM
- Redis (presence cache / pub-sub hook — app runs fine without it)
- Socket.IO (realtime gateway: presence, messages, typing, party, notifications)
- LiveKit server SDK (voice token issuance + room lifecycle hooks)
- Passport + JWT (access/refresh) + Google/Discord/GitHub/Twitch/Steam OAuth
- Zod (env validation) + class-validator (request DTOs)
- Swagger / OpenAPI
- Docker + docker-compose (API, Postgres, Redis)
- Jest (unit tests)

## Getting started

```bash
npm install          # also runs `prisma generate` via postinstall
cp .env.example .env # fill in DATABASE_URL and JWT secrets at minimum
npx prisma migrate dev --name init   # creates the Postgres schema
npx prisma db seed                   # optional: realistic sample data
npm run start:dev
```

API: `http://localhost:3000/api/v1`
Swagger docs: `http://localhost:3000/docs`

### Or with Docker

```bash
cp .env.example .env
docker compose up --build
```

This starts Postgres, Redis, and the API together. Run migrations once the
containers are up:

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

## A note on `prisma generate`

Prisma's CLI downloads its query/schema-engine binaries from
`binaries.prisma.sh` the first time you run `generate` (this repo's
`postinstall` script runs it automatically after `npm install`). That
requires normal outbound internet access on whatever machine you install
this on — which is the standard, expected setup for any Prisma project.

This backend was built in a sandboxed environment whose network egress is
restricted to a small domain allowlist that does not include
`binaries.prisma.sh`, so the Prisma client could not be generated or run
there. To still verify the surrounding NestJS application (imports, types,
decorators, guards, business logic) in that environment, a temporary,
clearly-labeled compile-only shim stood in for `@prisma/client`'s generated
types during development — it has been fully removed from this codebase.
Every Prisma-touching query (relations, field names, and every compound
`@@unique` key) was manually cross-checked against `prisma/schema.prisma`
for correctness. On a normal machine, `npm install` resolves this
automatically and the project builds and runs like any other Prisma + NestJS
app.

## Environment variables

See `.env.example` for the full list. Minimum required to boot:

- `DATABASE_URL` — Postgres connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — at least 16 characters each

Everything else (Redis, mail, OAuth providers, LiveKit, S3) has safe
defaults or degrades gracefully:

- **Redis** — presence caching and pub/sub hooks. The app boots and runs
  fully without it; calls just no-op with a logged warning.
- **Mail** — verification/reset emails log to the console when no SMTP
  server is configured, instead of failing the request.
- **LiveKit** — voice token generation is fully functional locally (it's a
  self-contained signed JWT) even without real LiveKit credentials; room
  administration (create/close) is a logged no-op hook until
  `LIVEKIT_URL`/keys are set to a real deployment.
- **OAuth providers** — each of Google/Discord/GitHub/Twitch/Steam only
  works once you set its client ID/secret; omitted providers simply won't
  complete the OAuth handshake (`/auth/<provider>` will fail with the
  provider rejecting `not-configured` credentials) without affecting the
  rest of the app.
- **Uploads** — defaults to local disk storage (`./uploads`, served at
  `/static`). Set `UPLOAD_DRIVER=s3` with `S3_*` vars for S3-backed storage.

## API overview

All routes are versioned and prefixed: `/api/v1/...`. Every response is
wrapped in `{ success, data, timestamp }` (or `{ success: false, error }` on
failure) by a global interceptor/exception filter.

| Module | Base path | Covers |
|---|---|---|
| Auth | `/api/v1/auth` | register, login, refresh, logout, forgot/reset password, verify email, sessions, OAuth (google/discord/github/twitch/steam) |
| Users | `/api/v1/users` | profile, presence, preferences, search |
| Friends | `/api/v1/friends` | requests, friendships, pin, block/unblock, mutuals |
| Conversations | `/api/v1/conversations` | DMs, groups, messages, reactions, pins, replies, search |
| Party | `/api/v1/party` | create/invite/leave/kick/transfer, settings, voice token |
| Voice | `/api/v1/voice` | join a community voice channel, reconnect |
| Communities | `/api/v1/communities` | CRUD, membership, channels, roles/permissions, events, announcements |
| Notifications | `/api/v1/notifications` | list, unread count, mark read, delete |
| Search | `/api/v1/search` | global + scoped search |
| Settings | `/api/v1/settings` | preferences, change password, delete account |
| Uploads | `/api/v1/uploads` | avatar, community icon, message attachments |

Full request/response schemas are in Swagger at `/docs`.

## Realtime (Socket.IO)

Namespace: `/realtime`. Authenticate by passing the access token as
`socket.handshake.auth.token`.

Client → server: `conversation:join`, `conversation:leave`, `typing:start`,
`typing:stop`, `party:join`, `party:leave`.

Server → client: `presence:update`, `message:created`, `message:updated`,
`message:notify`, `typing:update`, `notification:created`, `party:updated`.

## Testing

```bash
npm run test        # unit tests (mocked repositories — no DB required)
npm run test:e2e     # smoke test against a running app (needs DATABASE_URL reachable)
npm run test:cov
```

## Project structure

```
prisma/schema.prisma   Single source of truth for the data model
prisma/seed.ts          Realistic sample data
src/
  config/               Zod-validated environment config
  database/             PrismaService (global)
  shared/               Redis, Mail, LiveKit, Storage (local + S3) — all global
  common/               Exception filter, interceptors, decorators, DTOs, guards
  auth/                 JWT + 5 OAuth strategies, sessions, tokens
  users/ friends/ messages/ party/ voice/ communities/
  notifications/ search/ settings/ uploads/
  realtime/             Socket.IO gateway + WS JWT guard
```

Each feature module follows the same layering: `*.controller.ts` (HTTP only)
→ `*.service.ts` (business rules, no Prisma calls) → `*.repository.ts` (all
Prisma access for that module). Cross-module calls go through a service's
public methods, never through another module's repository directly.

## Docker

`Dockerfile` is a multi-stage build (installs deps, runs `prisma generate`,
compiles, then a slim production image with only prod deps). `docker-compose.yml`
brings up the API alongside Postgres and Redis with healthchecks.

## What's deliberately out of scope for Phase 2

Per the brief: Postgres is schema-only until you run migrations yourself;
Redis and LiveKit are wired as real integration hooks rather than assuming a
live cluster; and this backend does not modify the Phase 1 frontend UI.
