# Connection pooling

Prisma manages its own connection pool per `PrismaClient` instance (one
per running Node process) — there's no separate pooler configured, since
SquadLink's expected instance count doesn't yet justify the operational
overhead of PgBouncer/pgcat in front of it. Revisit this once running more
than a handful of backend instances against one Postgres.

## Sizing

`connection_limit` (query param on `DATABASE_URL`) controls Prisma's pool
size for that process. Prisma's default is `num_cpus * 2 + 1`, which is
tuned for a single instance, not for many instances sharing one Postgres.

Rule of thumb, set explicitly in each `.env.*.example`:

```
connection_limit ≈ postgres_max_connections / number_of_app_instances
```

...leaving headroom for `prisma migrate deploy` connections, `psql`/admin
sessions, and any read-replica or monitoring connections. For example,
against a managed Postgres with `max_connections = 100` and 4 backend
instances, `connection_limit=20` per instance leaves 20 connections of
headroom.

- `.env.development.example` — `connection_limit=5` (single local instance, low stakes)
- `.env.test.example` — `connection_limit=5` (test runs are short-lived and often parallelized across suites)
- `.env.production.example` — `connection_limit=10` as a starting point; tune against real `max_connections` and instance count

`pool_timeout` (seconds Prisma waits for a free connection before
throwing) defaults to 10s in all three — increase it only if you see
timeout errors under legitimate load, not as a first response to pool
exhaustion (that usually means the limit itself is wrong, or a query is
holding a connection too long).

## Idle connections / timeouts

Prisma's pool doesn't currently expose an idle-timeout knob directly (this
is a Prisma/Postgres driver-level detail, not something this app's config
controls beyond `connection_limit`/`pool_timeout`). If idle-connection
buildup becomes a problem at scale, that's the point to introduce
PgBouncer in transaction-pooling mode in front of Postgres, which is
designed exactly for that.

## Stability with multiple instances

Because every instance's pool size is capped and centrally documented
(this file + the `.env.*.example` comments), adding an instance means
recomputing `connection_limit`, not hoping the defaults hold. This was
previously undocumented — `DATABASE_URL` had no pool params at all — so
"the system should remain stable when multiple backend instances run
simultaneously" wasn't actually guaranteed by anything in the repo.
