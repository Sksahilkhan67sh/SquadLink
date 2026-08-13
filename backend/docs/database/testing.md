# Database testing

## Test database isolation

**Tests must never run against the development or production database.**
Two layers of protection:

1. `.env.test.example` points `DATABASE_URL` at `squadlink_test`, a
   separate database (`docker-compose.test.yml` spins up an isolated
   Postgres container for it, on a different host port, with no
   persistent volume — it starts empty every run).
2. `test/database/schema-constraints.integration-spec.ts` (see below)
   additionally throws at startup if its target connection string doesn't
   contain the substring `"test"`, as a hard guardrail against a
   misconfigured environment variable pointing it at a real database.
   `TEST_DATABASE_URL` overrides the default so CI can point it anywhere
   test-appropriate without touching `DATABASE_URL`.

## What's covered, and by what

| Suite | Runs via | What it verifies |
|---|---|---|
| `test/database/schema-constraints.integration-spec.ts` | `npm run test:integration` | DB-level constraint enforcement — duplicate prevention (email, handle, friendship, friend request, reaction, conversation/community/party membership), cascade behavior (conversation→messages, message→attachments/reactions, party→members/invites), `Restrict` on owner deletion, `SetNull` on reply/actor references |
| `src/**/*.spec.ts` (existing + new) | `npm test` | Service-layer logic: authorization checks, validation, the account-deletion flow's orchestration (mocked repository), friend-request/party-invite state-machine guards |
| `test/app.e2e-spec.ts` | `npm run test:e2e` | Full HTTP-level app bootstrap (pre-existing; requires a generated `@prisma/client` — see caveat below) |

### Why the DB-constraint suite exists as a separate, `pg`-only suite

Ideally, DB behavior is verified through the same `@prisma/client`-based
repositories the app actually uses. In the environment this phase was
built in, `@prisma/client` couldn't be generated (see
`migration-strategy.md`'s network-limitation note), which would have made
*all* DB-touching tests impossible to actually run and verify here.

`test/database/schema-constraints.integration-spec.ts` uses the `pg`
driver directly instead, deliberately bypassing Prisma, so the schema's
constraints could still be exercised for real against a real Postgres
instance rather than only reviewed by eye. All 14 of its tests pass — see
`verification-report.md`.

**Once `@prisma/client` can be generated**, add the equivalent (and more
complete — this covers constraints, not application logic) coverage as
`*.repository.spec.ts` files that use a real `PrismaService` against the
test database, for the behaviors listed in the original Phase 3 brief:
user creation, message creation + reactions, conversation membership,
party/community membership + role assignment, notification creation, and
the account-deletion transaction end-to-end (not just its orchestration,
which the mocked `UsersService` spec already covers).

## Seed data

`prisma/seed.ts` is unchanged by this phase — it already only creates
clearly-fake development users/data (no real credentials, no production
secrets), uses `upsert` so it's safe to re-run, and needed no changes for
the new `deletedAt` columns (both are nullable with no default required).
Run it with `npm run prisma:seed` after migrating a dev database.

## Performance testing

Not run in this environment — no generated Prisma client to drive load
against a real dataset (see the CLI-access caveat throughout these docs).
Once that's unblocked, a reasonable Phase 3-scale check:

```bash
# Seed ~1K users / ~10K messages across a handful of conversations, then:
npx prisma studio # spot-check shape
# Time a representative query directly:
psql "$DATABASE_URL" -c '\timing on' \
  -c "EXPLAIN ANALYZE SELECT * FROM \"Message\" WHERE \"conversationId\" = '<id>' ORDER BY \"createdAt\" DESC LIMIT 50;"
```

Confirm the `EXPLAIN ANALYZE` output shows an index scan on
`Message_conversationId_createdAt_idx`, not a sequential scan, before
claiming the index is doing its job — don't claim "supports millions of
messages" without that evidence, per the Phase 3 brief.
