# Redis strategy

Postgres is the source of truth for everything durable. Redis holds only
derived or ephemeral state, and the app is designed to keep working
(degraded, not broken) if Redis is unreachable — `RedisService` connects
lazily, logs a warning instead of throwing on connection failure, and
every helper method checks `isConnected` and no-ops (returns `null`/does
nothing) rather than throwing.

## Key naming

| Prefix | Example | TTL | Purpose |
|---|---|---|---|
| `presence:{userId}` | `presence:u_123` | 120s | Online/in-game/idle status, refreshed on activity |
| `cache:user:{userId}` | `cache:user:u_123` | 300s (5 min) | Cached user profile read |
| `cache:community:{communityId}` | `cache:community:c_456` | 300s (5 min) | Cached public community metadata |
| `rate-limit:{identifier}` | `rate-limit:login:1.2.3.4` | window length (caller-supplied) | Fixed-window request counter |
| `session:{sessionId}` | *(reserved, not yet used)* | — | Session tables live in Postgres today (`Session` model); this prefix is reserved if a future Socket.IO/Redis session cache is added |

## TTL and invalidation

- **Presence** — short TTL (120s) with the client expected to refresh it
  periodically; if a client disconnects without cleaning up, the key
  simply expires rather than needing an explicit invalidation path.
- **User/community caches** — 5-minute TTL is the primary invalidation
  mechanism (accept slightly stale reads for these low-churn-relative-to-
  read-volume fields). `RedisService.invalidateUser` /
  `invalidateCommunity` are provided for callers that want to actively
  bust the cache on a write (e.g. after `UsersService.updateProfile`) —
  wiring those calls into the write paths is a straightforward follow-up
  once caching is actually turned on for read paths that currently go
  straight to Postgres; Phase 3 adds the primitives, per the "don't cache
  everything, cache only where it helps" guidance, without introducing
  cache-consistency bugs into read paths that don't need it yet.
- **Rate limiting** — `checkRateLimit(identifier, limit, windowSeconds)`
  does an atomic `INCR`, and sets the key's `EXPIRE` only on the *first*
  increment in a window (so the TTL isn't reset by every request, which
  would let a sufficiently persistent client keep the window open
  forever). Fails open (`allowed: true`) if Redis is unreachable —
  correct for a system where Redis is explicitly not a hard dependency.

## What's NOT cached

Highly dynamic data — message content, live party/voice state, unread
counts, friend-request status — is not cached. These change too often
relative to their read pattern for a cache to pay for itself, and staleness
here is user-visible in a way that matters (e.g. showing a stale unread
count).

## Multi-instance considerations

`RedisService.publish`/the pub/sub hook exists for Socket.IO adapter
fan-out across multiple backend instances — necessary once the app runs
as more than one process, so that a message delivered to instance A's
Socket.IO server reaches a recipient connected to instance B.
