# SquadLink — Database & Data Infrastructure (Phase 3)

This directory documents the data layer built in Phase 3: schema, indexing,
migrations, Redis, backups/DR, and testing. Start here, then follow the
links below for the topic you need.

- [schema-and-indexes.md](./schema-and-indexes.md) — model inventory, relationships, delete strategy, index rationale
- [deletion-strategy.md](./deletion-strategy.md) — how account/community/party deletion actually works and why
- [migration-strategy.md](./migration-strategy.md) — migration workflow, and why the init migration was hand-authored in this environment
- [query-guidelines.md](./query-guidelines.md) — pagination, N+1 avoidance, transactions, concurrency patterns used in the repositories
- [redis-strategy.md](./redis-strategy.md) — key naming, TTLs, cache invalidation, rate limiting
- [connection-pooling.md](./connection-pooling.md) — Prisma/Postgres connection pool sizing
- [backup-and-recovery.md](./backup-and-recovery.md) — backup schedule, RPO/RTO, restore test procedure
- [testing.md](./testing.md) — test database setup, what's covered, how to run it
- [verification-report.md](./verification-report.md) — Phase 3 definition-of-done checklist with evidence

## Architecture at a glance

```
                         ┌─────────────────────┐
                         │   NestJS backend     │
                         │  (Node, one or more   │
                         │      instances)       │
                         └──────┬─────────┬──────┘
                                │         │
                    Prisma Client         ioredis
                                │         │
                    ┌───────────▼──┐  ┌───▼──────────┐
                    │  PostgreSQL   │  │    Redis      │
                    │ (source of    │  │ (presence,    │
                    │   truth)      │  │  cache, rate-  │
                    │               │  │  limit — never │
                    │               │  │  source of     │
                    │               │  │  truth)        │
                    └───────────────┘  └───────────────┘
```

PostgreSQL is the single source of truth for everything durable. Redis is
optional at boot (the app degrades gracefully — see
[redis-strategy.md](./redis-strategy.md)) and only ever holds derived or
ephemeral state: presence, short-TTL caches, and rate-limit counters.

## Model groups (see schema-and-indexes.md for full detail)

- **Identity & sessions** — `User`, `UserPreferences`, `OAuthAccount`, `Session`, `EmailVerificationToken`, `PasswordResetToken`
- **Friends** — `FriendRequest`, `Friendship`, `Block`
- **Messaging** — `Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment`, `MessageReaction`
- **Party & voice** — `Party`, `PartyMember`, `PartyInvite`, `VoiceRoom`
- **Communities** — `Community`, `CommunityMember`, `CommunityRole`, `CommunityMemberRole`, `ChannelGroup`, `Channel`, `CommunityEvent`, `Announcement`
- **Notifications & uploads** — `Notification`, `Upload`

28 tables total, defined in `prisma/schema.prisma`; DDL in
`prisma/migrations/20260808000000_init/migration.sql`.
