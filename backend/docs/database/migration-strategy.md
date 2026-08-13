# Migration strategy

## Workflow

- **Development:** `npx prisma migrate dev` — creates a new migration from
  any schema.prisma changes, applies it to your dev database, and
  regenerates the client.
- **Production:** `npx prisma migrate deploy` — applies pending migrations
  only, never generates new ones, never uses `db push`. This is what CI/CD
  should run against the production database.
- **Naming:** Prisma's default `<timestamp>_<description>` naming is used
  (e.g. `20260808000000_init`). Keep descriptions short and specific
  (`add_message_soft_delete`, not `fix`).
- Every migration lives in `prisma/migrations/<name>/migration.sql` plus
  the shared `migration_lock.toml`. Never hand-edit a migration that's
  already been applied anywhere — write a new one.

## Why the init migration was hand-authored

`prisma migrate dev`/`diff`/`generate` all need Prisma's native
query-engine binary, fetched from `binaries.prisma.sh` at generate time.
In the sandbox this phase was built in, that host is blocked by the
network allowlist (confirmed via direct `curl`:
`x-deny-reason: host_not_allowed`), so the Prisma CLI could not run at
all — not even `prisma validate`.

Postgres and Redis themselves were installable locally (via `apt`, an
allowed source), so rather than leave the schema unverified, the initial
migration (`prisma/migrations/20260808000000_init/migration.sql`) was
**hand-written** to mirror `schema.prisma` using Prisma's documented
default PostgreSQL DDL conventions (table/column names preserved exactly
as declared, single-field `@unique` → a named unique index, `@@unique` →
composite unique index, `@@index` → composite btree index, FKs added via
`ALTER TABLE` after all tables exist), and then **actually applied to a
real local Postgres 16 instance** with `psql -v ON_ERROR_STOP=1`. It ran
clean: 28 tables, 38 foreign keys, 79 indexes, with `Community_ownerId`
and `Party_ownerId` confirmed as `RESTRICT` (`confdeltype = 'r'`) via
`pg_constraint`. See `docs/database/verification-report.md` for the full
command transcript.

**This is not a substitute for the normal workflow** — it's what was
possible without CLI access. Before this migration is trusted as the
permanent history for a real environment, run:

```bash
# Wherever binaries.prisma.sh (or your platform's engine mirror) is
# reachable — a real dev machine, CI, or once this sandbox's network
# allowlist includes it:
npm install
npx prisma validate
npx prisma generate
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/generated-init.sql
diff /tmp/generated-init.sql prisma/migrations/20260808000000_init/migration.sql
```

If that diff isn't empty, trust the CLI-generated SQL and replace the
hand-authored file — some Prisma version/engine detail (e.g. a `DEFAULT`
expression syntax) may have been guessed slightly wrong by hand even
though it validated successfully against real Postgres.

Then apply and confirm the client works end-to-end:

```bash
npx prisma migrate deploy      # applies the migration + records it in _prisma_migrations
npx prisma migrate status      # should report "up to date"
npx prisma generate
npm run build
npm test
npm run test:integration       # see docs/database/testing.md
```

## What was actually verified in this environment vs. what wasn't

| Step | Status here |
|---|---|
| Schema reviewed for correctness (relations, constraints, cascade behavior) | ✅ Done, manually |
| Migration SQL applies cleanly to real Postgres | ✅ Done — applied to both `squadlink` and `squadlink_test` |
| Constraints behave as designed (unique, cascade, restrict, set-null) | ✅ Done — 14 passing tests in `test/database/schema-constraints.integration-spec.ts`, run directly against Postgres |
| `npx prisma validate` / `generate` / `migrate dev` / `migrate deploy` | ❌ Blocked — `binaries.prisma.sh` unreachable in this sandbox |
| `@prisma/client`-based repository/service tests | ⚠️ Run, but the generated client is a placeholder stub (no real types/enums), so tests touching runtime `@prisma/client` enum values fail with `TypeError: Cannot read properties of undefined` — confirmed unrelated to this phase's code changes (see `verification-report.md`) |
| `npm run build` (`nest build`) | ❌ Same root cause — depends on generated Prisma types |
| Docker Compose stack (`docker compose up`) | ❌ Not run — no Docker daemon in this sandbox; compose file reviewed manually instead (see `docker-compose.yml`) |

Do not treat this phase as "production ready" on the strength of what ran
here alone — run the commands above in an environment with normal
internet access (or once `binaries.prisma.sh` is allow-listed) before
deploying.
