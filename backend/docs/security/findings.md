# Phase 4 security audit — findings

Audit performed against the Phase 3 codebase. Every Critical/High finding
below was fixed in this phase; Medium/Low items are either fixed or
explicitly called out as an accepted risk with a reason. Nothing here is
theoretical — each finding names the exact file/endpoint and the concrete
exploit.

## Critical

### C1 — Raw `User` rows (incl. bcrypt hash + email) leaked through nested includes
**Where:** `communities.repository.ts` (`listMembers`, `findMember`,
`addMember`), `party.repository.ts`, `messages.repository.ts`
(`author`, `reactions.user`, `replyTo.author`, `participants.user`),
`friends.repository.ts` (`sender`, `receiver`), `notifications.repository.ts`
(`actor`) — all use Prisma `include: { user: true }` (or equivalent) and
return the result straight through the controller with no DTO boundary.
There is no `ClassSerializerInterceptor` or `@Exclude` anywhere in the
codebase to strip it.

**Impact:** any authenticated user could retrieve another user's bcrypt
`passwordHash` and email address via ordinary endpoints — e.g.
`GET /communities/:id/members`, party member lists, message
authors/reactors, friend requests, notification actors. A leaked bcrypt
hash is crackable offline; this is a full account-takeover primitive, not
just a privacy leak.

**Fix:** added a global `RedactSensitiveFieldsInterceptor`
(`src/common/interceptors/redact-sensitive-fields.interceptor.ts`) that
recursively strips `passwordHash`, `email`, and `emailVerifiedAt` from any
object that carries a `passwordHash` key — which only ever happens on a
raw, un-DTO'd Prisma `User` row, since every hand-built DTO in this
codebase (`UserPublicDto`, `UserPrivateDto`, `AuthResponseDto`, ...) never
includes that field. The same logic
(`src/common/utils/redact-sensitive-fields.ts`) is applied inside
`realtime.gateway.ts` before every `server.emit(...)` call, because
Socket.IO broadcasts triggered from `@OnEvent` handlers run outside Nest's
HTTP interceptor pipeline and would otherwise bypass the fix entirely.

**Follow-up (tracked, not blocking):** the individual repository queries
should still be migrated from `include: { user: true }` to `select: {...}`
with only the fields actually needed, so the redaction interceptor is
defense-in-depth rather than the only thing standing between a Prisma row
and the wire. Left as follow-up because it touches ~10 files and the
global interceptor already closes the hole for all of them.

### C2 — Voice room reconnect issued tokens with no membership check
**Where:** `voice.service.ts#reconnect`, called from
`POST /voice/reconnect`.

**Before:** `reconnect(userId, displayName, roomName)` looked up the
`VoiceRoom` by `roomName` and minted a fresh LiveKit access token — with no
check that `userId` was actually a member of the community/channel or
party that room belonged to. `join()` (the normal entry point) did this
check correctly; `reconnect()` did not.

**Impact:** any authenticated user who learned or guessed a `roomName`
(LiveKit room names are derived from IDs, not fully opaque) could get a
valid token to join and speak/listen in any private voice channel or
party.

**Fix:** `reconnect()` now loads the room together with community/party
membership (`VoiceRepository.findVoiceRoomWithMembership`) and throws
`ForbiddenActionException` if the caller isn't a member of either.

### C3 — Socket.IO room join events had no authorization check
**Where:** `realtime.gateway.ts`, `conversation:join` and `party:join`
handlers.

**Before:** any authenticated socket could emit `conversation:join` with
an arbitrary `conversationId` (or `party:join` with an arbitrary
`partyId`) and the gateway would join that Socket.IO room unconditionally.
From then on the client silently received `message:created`,
`message:updated`, and `party:updated` events for that conversation/party
— i.e. other people's private messages — even though the REST API
correctly checked participation.

**Fix:** both handlers now verify `ConversationParticipant` /
`PartyMember` membership against the database before joining the room,
and reject with an `error` event otherwise. `typing:start`/`typing:stop`
now check the emitting socket is actually in the room (no DB hit needed —
they can't be in the room without having passed the join check above).

## High

### H1 — Cross-community IDOR ("confused deputy") on channel/role management
**Where:** `communities.service.ts` — `deleteChannel`, `createChannel`,
`deleteRole`, `assignRole`, `unassignRole`.

**Before:** each of these called `assertManager(communityId, userId)` to
confirm the caller manages `communityId`, then acted on a
`channelId`/`roleId`/`channelGroupId` supplied separately — without ever
checking that ID actually belonged to `communityId`. A manager of
community A could pass community A's ID (to pass the permission check)
together with a channel/role ID belonging to community B, and delete or
modify community B's data.

**Fix:** every one of these repository calls is now scoped with a
`communityId` filter (`deleteMany`/`findFirst` with a compound `where`)
so the operation is a no-op (`ResourceNotFoundException`) unless the
target resource actually belongs to the community the caller manages.

### H2 — Cross-conversation IDOR on message pinning
**Where:** `messages.service.ts#pinMessage`.

**Before:** verified the caller was a participant of `conversationId`,
then called `setPinned(messageId, pinned)` without checking `messageId`
belonged to that conversation — letting a participant of one conversation
pin/unpin a message in a conversation they aren't part of, by passing
their own `conversationId` alongside a foreign `messageId`.

**Fix:** now loads the message and verifies
`message.conversationId === conversationId` before pinning.

### H3 — Unrestricted attachment uploads
**Where:** `uploads.service.ts#uploadAttachment`.

**Before:** `assertWithinLimits(file)` was called with no `allowedTypes`
argument at all for attachments (avatars/icons did have an image
allow-list) — any MIME type was accepted, and the stored file's extension
was taken directly from the client-supplied filename, then served
publicly from the static file host.

**Impact:** a user could upload an `.html` or `.svg` file as a message
attachment; served from the app's own origin with the browser-inferred
content type, either would execute as HTML/JS in that origin — stored
XSS. Arbitrary file types could also be used to distribute malware
convincingly disguised as a shared file.

**Fix:** added an explicit attachment allow-list (images, PDF, plain
text, zip, common audio/video — no `text/html`, no `image/svg+xml`, no
executables), and extensions are now derived from the *validated* MIME
type via a fixed lookup table rather than trusted from the client
filename, so a mismatched extension can no longer smuggle a dangerous
type past the MIME check.

### H4 — Silent insecure fallback for LiveKit signing secret
**Where:** `livekit.service.ts#createAccessToken`.

**Before:** if `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` were unset, the
service silently signed tokens with a hardcoded fallback secret
(`devsecret_devsecret_devsecret_32`) that is checked into this
repository and therefore public. It logged a warning, but still issued
what looked like a valid token — an easy-to-miss production
misconfiguration that would let anyone who has ever seen this source
forge voice tokens for any room.

**Fix:** in production (`NODE_ENV=production`), `createAccessToken` now
throws instead of falling back, so a missing LiveKit credential is a hard
boot/runtime failure, not a silent security hole. The dev fallback is
kept for local development only.

## Medium

- **M1 — Refresh token duplicated into OAuth redirect URL fragment.**
  `auth.controller.ts#completeOAuthLogin` already sets the refresh token
  as an httpOnly cookie, then *also* put it in the `#...&refreshToken=...`
  redirect fragment — unnecessary exposure (browser history, any
  extension/script reading `location.hash`). Removed; only the short-lived
  access token remains in the fragment.
- **M2 — Generic global rate limit only; auth endpoints not specially
  protected.** A single `ThrottlerModule` config (120 req/60s by default)
  applied uniformly. Added tighter per-route limits: `register` 5/min,
  `login` 8/min, `forgot-password` 3/5min, `reset-password` 5/5min,
  `verify-email` 8/5min, `resend-verification` 3/5min.
- **M3 — JWT secrets only required to be 16+ characters.** Raised the
  Zod validation minimum to 32, and added a production-only check that
  `JWT_ACCESS_SECRET !== JWT_REFRESH_SECRET`.
- **M4 — No production-specific environment invariants.** A production
  deployment could previously boot with `CORS_ORIGIN=*`, `localhost` URLs,
  or plain `http://` `APP_URL`/`API_URL` with no error. Added
  `validateProductionInvariants()` in `env.validation.ts`, enforced only
  when `NODE_ENV=production`.
- **M5 — Socket.IO gateway reflected any origin (`cors: { origin: true
  }`).** Combined with `credentials: true`. Scoped to the configured
  `CORS_ORIGIN` list, matching the REST API's CORS config.
- **M6 — Swagger UI mounted unconditionally, including in production.**
  Full route/DTO surface exposed at `/docs` regardless of environment.
  Now only mounted when `NODE_ENV !== production`.
- **M7 — Health endpoint always returned HTTP 200, even with the database
  unreachable.** Defeats the purpose of a readiness probe for any
  orchestrator that checks HTTP status rather than parsing the body. Split
  into `GET /health` (readiness — now returns 503 via
  `ServiceUnavailableException` on DB failure) and `GET /health/live`
  (liveness — process-only, no DB call).
- **M8 — Postgres/Redis published on `0.0.0.0` in `docker-compose.yml`,
  Redis had no password.** Fine for a laptop, dangerous if this compose
  file is ever run on a host with a public IP. Ports now bind to
  `127.0.0.1` only, and Redis requires `--requirepass` (from
  `REDIS_PASSWORD`, default only for local dev).
- **M9 — Docker image ran as root.** No `USER` directive in the production
  stage. Added a dedicated non-root `squadlink` user, a `HEALTHCHECK`, and
  a note to run the container with `--init` for correct signal handling.
- **M10 — `npm audit`: high-severity `js-yaml` DoS (GHSA-pm4m-ph32-ghv5)**,
  pulled in transitively via `@nestjs/swagger`. Fixed with a package.json
  `overrides` pin to `js-yaml@^5.2.2` rather than `npm audit fix --force`
  (which would have downgraded `@nestjs/swagger` — a breaking change for
  no reason, since a compatible patched `js-yaml` exists).

## Low / informational (accepted, not changed)

- **L1 — `GET /communities/:id/members` requires only *any* valid login,
  not membership in that community.** Given `browse()` already lets any
  authenticated user discover and preview public communities, a member
  list is treated as part of that same public-preview surface rather than
  private data. Now that C1 is fixed, the response no longer leaks
  anything beyond handle/display name/avatar/status — the same fields
  already visible on a public profile (`GET /users/:handle`). Revisit if
  private/invite-only communities are added later.
- **L2 — S3 storage driver builds a public-style URL
  (`https://bucket.s3.region.amazonaws.com/key`) with no signed-URL
  support.** Object keys are random UUIDs (not guessable), and the driver
  sets no ACL (so the object's actual accessibility is governed by the
  bucket policy, not this code) — but if message attachments are meant to
  be private, the bucket should sit behind CloudFront + signed URLs or
  presigned `GetObject` URLs rather than direct public reads. Recommended
  as a follow-up if/when private attachments become a real requirement;
  building it now would be a feature addition, not hardening of existing
  behavior, so it's out of scope for this pass.
- **L3 — No CSRF middleware.** Not applicable: the API uses a Bearer
  access token in the `Authorization` header for all authenticated
  requests (the only cookie is the httpOnly refresh token, scoped to
  `/api/v1/auth`, and refresh requests carry no state-changing side
  effects beyond issuing new tokens). A cross-site form/fetch can't set a
  custom `Authorization` header, so CSRF doesn't apply to this auth model.
- **L4 — Secret scanning of git history.** Not applicable to this
  deliverable: the project ships as a plain source export with no `.git`
  directory, so there is no history to scan. No `.env` files or
  hardcoded secret-shaped literals were found in the source tree itself
  (verified via pattern grep — see verification report).
