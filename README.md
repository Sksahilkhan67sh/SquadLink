# SquadLink

A social/gaming platform: friends, DMs, parties with voice, and
Discord-style communities with channels.

- `frontend/` — React + Vite (Phase 1)
- `backend/` — NestJS + Prisma + PostgreSQL + Redis (Phase 2 app, Phase 3 data layer)

## Phase status

- **Phase 1** — Frontend (superseded — see Integration below)
- **Phase 2** — Backend API (complete, unchanged this phase except the
  fixes below)
- **Phase 3** — Database & data infrastructure — see
  [`backend/docs/database/verification-report.md`](./backend/docs/database/verification-report.md)
- **Phase 4** — Security & production hardening (base security work from
  this zip's source; not re-audited beyond the integration pass below)
- **Integration** (this delivery) — full-stack wiring is done; see
  [`INTEGRATION-REPORT.md`](./INTEGRATION-REPORT.md) for the complete,
  evidence-based status of every integration point, what was fixed, what's
  a known limitation, and what could not be verified in a sandbox without
  Docker/Postgres/Redis/LiveKit access.

## Start here for Integration

[`INTEGRATION-REPORT.md`](./INTEGRATION-REPORT.md) — full audit findings,
fixes made, and honest PASS/FAIL/NOT VERIFIED status per integration point.

## Start here for Phase 3

[`backend/docs/database/README.md`](./backend/docs/database/README.md) —
architecture overview and links to every topic (schema/indexes, deletion
strategy, migrations, Redis, connection pooling, backup/DR, testing).

## Quick start (backend)

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL/JWT secrets for your machine
docker compose up -d postgres redis
npm install
npx prisma migrate deploy     # or: npx prisma migrate dev, for local dev
npm run prisma:seed
npm run start:dev
```

**Before trusting this in production:** the `prisma generate`/`validate`/
`build` steps above could not be executed in the sandbox this phase was
built in (see the verification report for why, and the exact commands to
finish verification). Run them somewhere with normal internet access
first.

## Running the DB-level tests

```bash
cd backend
docker compose -f docker-compose.test.yml up -d
npm install
TEST_DATABASE_URL=postgresql://squadlink:squadlink@localhost:5433/squadlink_test?schema=public \
  npm run test:integration
```
