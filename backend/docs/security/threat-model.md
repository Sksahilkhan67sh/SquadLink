# Threat model & security architecture

## Assets

- User credentials (password hashes, OAuth account links)
- Access/refresh tokens, password-reset and email-verification tokens
- Private messages (DMs and community/party channel content)
- Voice room access (LiveKit tokens)
- User PII (email, display info)
- Uploaded files (avatars, community icons, message attachments)

## Trust boundaries

```
Browser/client  --https-->  Reverse proxy / LB  --http-->  NestJS API
                                                     |
                                          private network only
                                                     |
                                        PostgreSQL <-+-> Redis
```

Only the reverse proxy is internet-facing. The API, Postgres, and Redis
are never directly reachable from the internet in production (see
`deployment.md`). `docker-compose.yml` binds Postgres/Redis to
`127.0.0.1` for the same reason in local/single-host setups.

## Authentication model

- Passwords hashed with bcrypt (via `AuthService`); never logged, never
  returned in any response.
- Access tokens: short-lived JWTs (`JWT_ACCESS_EXPIRES_IN`, default 15m),
  signed with `JWT_ACCESS_SECRET` (32+ chars enforced, must differ from
  the refresh secret in production).
- Refresh tokens: longer-lived (`JWT_REFRESH_EXPIRES_IN`, default 30d),
  **hashed at rest** (see `tokens.service.ts`) — the raw token only ever
  exists in the httpOnly cookie and in the client's memory, never in the
  database. Rotated on every use; the previous token is invalidated.
- Refresh token delivery: httpOnly, `secure` in production, `sameSite:
  lax` cookie scoped to `/api/v1/auth`. Access tokens are returned in the
  response body / OAuth redirect fragment and are expected to be held in
  memory by the client, not persisted.
- Password reset / email verification tokens: opaque random values,
  hashed at rest, single-use, time-limited. See `tokens.service.ts`.
- OAuth: provider callback exchanges a code server-side; the resulting
  session is issued the same way as a password login (access token +
  refresh cookie). See `M1` in `findings.md` for the one issue found and
  fixed here.

## Authorization model

Authorization is enforced in the service layer, never assumed from the
frontend:

- **Global default-deny for auth:** `JwtAuthGuard` is registered as a
  global `APP_GUARD`; every route requires a valid access token unless
  explicitly marked `@Public()`.
- **Resource ownership / participation checks** happen inside each
  service method before any read or mutation — e.g.
  `assertParticipant(conversationId, userId)` in `messages.service.ts`,
  `assertManager(communityId, userId)` in `communities.service.ts`,
  membership lookups in `party.service.ts`.
- **Cross-tenant scoping:** every mutation that takes two IDs (a
  container ID the caller is checked against, and a target resource ID)
  must scope the second ID by the first at the database layer — this was
  the root cause of the H1/H2 findings and is now the pattern used
  throughout (`deleteMany({ where: { id, <parentId> } })` rather than
  `delete({ where: { id } })`).
- **Realtime (Socket.IO):** the transport-level connection is
  authenticated via `WsJwtGuard` (validates the access token from the
  handshake), but that only proves *who* the caller is — each
  room-scoped action (`conversation:join`, `party:join`) separately
  re-verifies membership in the database before granting access to that
  room's events. See C3 in `findings.md`.
- **Voice (LiveKit):** tokens are generated server-side only
  (`LiveKitService`, never exposes `LIVEKIT_API_SECRET` to any response)
  and only after a membership check — including on reconnect (C2).

## Rate limiting & abuse controls

- Global default: configurable via `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`
  (Redis-backed `ThrottlerModule`).
- Tighter per-route limits on all unauthenticated auth endpoints
  (register/login/forgot-password/reset-password/verify-email/resend-verification)
  — see M2 in `findings.md`.
- Upload size limits enforced per file type (`UPLOAD_MAX_SIZE_MB`).
- Existing party/community/message rate limiting per Phase 2/3 scope is
  unchanged by this phase; no new abuse controls beyond what's listed
  here were added, per the Phase 4 scope freeze.

## What this threat model does not cover

- DDoS mitigation at the network layer — expected to be handled by the
  reverse proxy / CDN in front of the API (see `deployment.md`), not the
  application itself.
- AI-based content moderation — explicitly out of scope for Phase 4.
- Multi-region / HA database topology — out of scope at this project
  stage (see `docs/database/backup-and-recovery.md`).
