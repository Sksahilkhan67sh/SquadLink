# Backup strategy & disaster recovery

SquadLink is pre-launch/early-stage, so these targets are intentionally
modest — right-sized for "one Postgres instance, not yet at a scale that
justifies read replicas or multi-region," per the Phase 3 brief's guidance
against implementing unrealistic enterprise guarantees. Revisit once
there's real production traffic and an SLA to design against.

## Backups

- **Automated daily backups.** If using a managed Postgres provider (RDS,
  Cloud SQL, Neon, Supabase, etc.), enable its built-in automated daily
  snapshot feature rather than rolling a custom `pg_dump` cron — managed
  snapshots are typically consistent, off-instance, and support
  point-in-time recovery out of the box, which a hand-rolled `pg_dump`
  script does not.
- **Point-in-time recovery (PITR):** enable WAL archiving / continuous
  backup if the provider supports it (most do). Target: able to restore to
  any point within the retention window, not just the last daily snapshot.
- **Retention:** 7 daily backups + 4 weekly backups is a reasonable
  starting point for this stage. Increase once there's a compliance or
  business reason to keep more.
- **Encryption:** backups must be encrypted at rest — this is a checkbox
  on essentially every managed provider; if self-hosting, encrypt the
  `pg_dump` output before it leaves the instance (e.g. `gpg` or the
  storage layer's server-side encryption).
- **Off-site:** backups must not live only on the same host/volume as the
  primary database — a managed provider's cross-region snapshot storage
  satisfies this; if self-hosting, ship dumps to a separate object storage
  bucket/region.

### Self-hosted fallback (if not using a managed provider)

```bash
# Daily, via cron:
pg_dump --format=custom --file="squadlink-$(date +%F).dump" "$DATABASE_URL"
# ...then upload the .dump file to off-instance storage (S3 etc.) and
# encrypt it there or before upload.
```

## Restore testing

> A backup that has never been restored is not a verified backup.

Quarterly (or after any major schema change), actually restore the most
recent backup into a scratch database and verify against a checklist:

```bash
createdb squadlink_restore_test
pg_restore --dbname=squadlink_restore_test squadlink-<date>.dump
psql squadlink_restore_test -c "SELECT count(*) FROM \"User\";"
psql squadlink_restore_test -c "SELECT count(*) FROM \"Message\";"
# Spot-check a few tables' row counts against what's expected, then:
dropdb squadlink_restore_test
```

Log the date and outcome of each restore test somewhere durable (a
runbook doc, an issue tracker ticket) — the point of the test is the
paper trail that it was actually done, not just that it's theoretically
possible.

## Disaster recovery targets

| Component | RPO (max acceptable data loss) | RTO (max acceptable downtime) |
|---|---|---|
| PostgreSQL | ~15 minutes (PITR-dependent) to 24h (daily-snapshot-only) | 1–4 hours (restore + redeploy) |
| Redis | N/A — everything in Redis is derived/ephemeral with a TTL (see redis-strategy.md); losing it entirely just means presence/cache/rate-limit state rebuilds from scratch, no data is actually lost | Minutes — just restart the container/service, no restore needed |
| Object storage (uploads / S3) | Depends on provider's own durability guarantee (S3: effectively 0 for committed writes) | Depends on provider |
| Application | 0 (stateless, redeployable from source) | Minutes (redeploy) |

### Recovery procedure (Postgres)

1. Identify the failure: instance down vs. data corruption vs. accidental
   mass-delete.
2. If the instance is down but data is intact: fail over to a
   replica/standby if one exists, or restart/replace the instance and
   reattach its volume.
3. If data is corrupted or was wrongly deleted: restore the most recent
   valid backup (or PITR to just before the incident) into a new instance,
   verify with the same checklist as restore testing above, then cut the
   app over to it via `DATABASE_URL`.
4. Run `npx prisma migrate status` against the restored instance before
   resuming traffic, to confirm the migration history matches what the
   application code expects.

These targets assume a single-region, single-primary Postgres — which is
what SquadLink actually runs today. Don't advertise stronger guarantees
than that.
