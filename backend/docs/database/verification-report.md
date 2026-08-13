# Phase 3 verification report

**Status: PARTIALLY COMPLETE.** The data-layer design, schema, migration,
and constraint-level correctness work is done and genuinely verified
against a real Postgres instance. The Prisma-CLI-dependent steps
(`generate`/`validate`/`build`/full test suite/Docker) could not be run in
this sandbox because `binaries.prisma.sh` is blocked by its network
allowlist (`x-deny-reason: host_not_allowed` on every attempt, including
two alternate-mirror workarounds). See
[migration-strategy.md](./migration-strategy.md) for the full explanation
and the exact commands to finish verification in an environment with
normal internet access.

**Do not call this "production ready" on this report alone** — finish the
❌/⚠️ rows below first.

## Definition-of-done checklist

| Item | Status | Evidence |
|---|---|---|
| Prisma schema validated | ⚠️ Manually reviewed, not CLI-validated | `npx prisma validate` blocked (engine download); schema reviewed model-by-model, see schema-and-indexes.md |
| Prisma Client generated | ❌ Blocked | `binaries.prisma.sh` unreachable — see migration-strategy.md |
| Migrations created | ✅ | `prisma/migrations/20260808000000_init/migration.sql`, hand-authored per Prisma's DDL conventions (see migration-strategy.md for why) |
| Migrations tested | ✅ | Applied clean to two real Postgres 16 databases via `psql -v ON_ERROR_STOP=1`: 28 tables, 38 foreign keys, 79 indexes, zero errors |
| Seed script works | ⚠️ Reviewed, not executed | Needs `@prisma/client`; unchanged by this phase (no schema changes required new seed fields); manually reviewed line-by-line for compatibility with the new schema |
| PostgreSQL runs correctly | ✅ | Postgres 16 installed and running in this sandbox; both `squadlink` and `squadlink_test` databases created and migrated |
| Redis runs correctly | ✅ | Redis 7 (via apt) running; `RedisService` reviewed/extended (structured cache + rate-limit helpers) — see redis-strategy.md |
| Relations verified | ✅ | Full manual audit — see schema-and-indexes.md's delete-strategy table |
| Constraints verified | ✅ | 14 passing tests, `test/database/schema-constraints.integration-spec.ts`, run directly against Postgres (see below) |
| Indexes verified | ✅ | Applied via migration; `pg_indexes` count confirmed (79 total) matches the schema |
| Transactions verified | ✅ | 5 new/fixed transactional operations (friend accept, party invite accept, community create + addMember, account deletion) — logic-tested where mockable, DB-applied for the constraints they rely on |
| Critical queries audited | ✅ | See query-guidelines.md |
| N+1 issues addressed | ✅ | `listConversationsForUser`'s per-conversation unread-count loop replaced with one aggregate query |
| Pagination verified | ✅ (kept, documented) | Offset pagination kept for the public API (frontend-contract-preserving); capped at 100/page; indexed. See query-guidelines.md for the non-breaking cursor-pagination migration path |
| Redis strategy documented | ✅ | redis-strategy.md |
| Backup strategy documented | ✅ | backup-and-recovery.md |
| Recovery procedure documented | ✅ | backup-and-recovery.md |
| Database tests pass | ✅ (DB-level) / ⚠️ (app-level) | 14/14 DB-constraint tests pass; 21/22 pre-existing + new unit tests pass — the 1 failure is confirmed environment-only (see below), not a regression |
| Performance tests completed | ❌ | Needs `@prisma/client` to generate a realistic dataset and drive load — see testing.md for the exact commands to run once unblocked |
| Docker database stack works | ⚠️ Reviewed, not executed | No Docker daemon in this sandbox; `docker-compose.yml` and new `docker-compose.test.yml` manually reviewed (Postgres persistent volume, Redis now correctly ephemeral — see below) |
| Backend continues to compile | ❌ | `nest build` needs generated Prisma types — blocked by the same root cause |
| Existing frontend remains compatible | ✅ | No REST contract changes; new `DELETE /api/v1/users/me` endpoint is additive only |
| No data-layer regressions | ✅ | Every FK/cascade change reviewed against existing repository code; the only behavior change visible to callers is `deleteMessage` now soft-deleting (content cleared, row kept) instead of hard-deleting — updated the 2 call sites (`react`/`unreact`/`editMessage` guards) accordingly |
| Documentation completed | ✅ | This directory |

## What was actually run, with output

```
$ apt-get install -y postgresql redis-server        # succeeded
$ service postgresql start && service redis-server start   # succeeded

$ psql -v ON_ERROR_STOP=1 -f prisma/migrations/20260808000000_init/migration.sql
CREATE TYPE (×11) ... CREATE TABLE (×28) ... CREATE INDEX (×49) ... ALTER TABLE (×38)
# zero errors, applied to both squadlink and squadlink_test databases

$ psql -c "SELECT conname, confdeltype FROM pg_constraint WHERE conname IN ('Community_ownerId_fkey','Party_ownerId_fkey');"
 Party_ownerId_fkey     | r
 Community_ownerId_fkey | r
# confirms RESTRICT, not the previous CASCADE

$ npx jest --config ./test/jest-integration.json
PASS test/database/schema-constraints.integration-spec.ts
  14 passed, 14 total

$ npx jest   # default unit-spec config
PASS src/users/users.service.spec.ts
PASS src/auth/tokens.service.spec.ts
FAIL src/friends/friends.service.spec.ts (1 of 22 tests)
  ● throws when the request was already responded to
    TypeError: Cannot read properties of undefined (reading 'PENDING')
```

### Why that one unit test failure isn't a real bug

`FriendRequestStatus` (and every other Prisma enum) is imported from
`@prisma/client`. Without a generated client, that import resolves to
`undefined` at runtime (`node -e "console.log(require('@prisma/client').FriendRequestStatus)"`
→ `undefined`), so any comparison against `FriendRequestStatus.PENDING`
throws a `TypeError` — not because the comparison logic is wrong, but
because the enum object doesn't exist yet. This code path is unchanged
from the original `friends.service.ts` (the same `!== FriendRequestStatus.PENDING`
check existed before this phase). Confirmed systemic, not a regression:
`npx eslint src/**/*.ts` produces the same class of failure (1221
`@typescript-eslint/no-unsafe-*` errors) across files this phase never
touched at all (e.g. `voice.repository.ts`, `voice.service.ts`) — because
every Prisma-derived type resolves to `any` in the placeholder client.

## Remaining known issues / follow-ups

1. **Finish CLI verification** once `binaries.prisma.sh` is reachable —
   run the command block in migration-strategy.md's "Why the init
   migration was hand-authored" section, in order: `validate` → `generate`
   → `migrate diff` (confirm it matches the hand-authored SQL) →
   `migrate deploy` → `build` → `test` → `test:integration`.
2. **Repository-level tests using the real Prisma client** — the
   DB-constraint suite proves the schema is correct; it doesn't exercise
   the actual repository/service code paths the way `@prisma/client`-based
   specs would. Add those once generation is unblocked (see testing.md).
3. **Performance testing at the 1K-user/10K-message scale** the brief
   asked for — not run; see testing.md for the exact commands.
4. **Cache invalidation isn't wired into write paths yet** — the
   `invalidateUser`/`invalidateCommunity` helpers exist
   (redis-strategy.md) but nothing calls them yet, because nothing reads
   through the cache yet either. Low risk as shipped (no cache = no
   staleness), but flagged so it's not forgotten once caching is actually
   turned on for a read path.
5. **Docker Compose stack** — reviewed but not executed (no Docker daemon
   here). Run `docker compose up` and `docker compose -f
   docker-compose.test.yml up` for real before relying on this report's
   review alone.
