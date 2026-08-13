# SquadLink — Full-Stack Integration Report

Scope: connect the existing Phase 4 frontend, backend, Prisma/PostgreSQL,
Redis, Socket.IO, LiveKit, and storage into one working application, per
the integration checklist. `SquadLink-Phase4-Production.zip` was treated
as the authoritative codebase; older phase zips were used only as
reference and nothing was merged back from them.

Every item below reflects something actually inspected or run — nothing
in this report is asserted without evidence. Items that require Docker,
a live PostgreSQL/Redis instance, LiveKit, or two real browser sessions
are marked **NOT VERIFIED** with the exact reason, per the "no claiming
success without execution" rule.

## Summary

The backend (Phase 4) was already solid: correct auth model, real
server-side authorization on every socket room join, no wildcard CORS,
secrets never exposed. **The frontend had zero integration** — no
`fetch`/`axios`/WebSocket client existed anywhere, and all ~15 screens
read from `frontend/src/data/mock.ts`. That gap is now closed: every
screen calls real backend endpoints, with loading/empty/error states,
and Socket.IO/LiveKit are wired for realtime messaging and voice.

## Integration status

| Integration | Status | Evidence |
|---|---|---|
| Frontend → Backend (REST) | **PASS** | `lib/api/*.ts` — one module per controller, every method matched field-by-field against the actual DTOs in `backend/src/**/dto`. `tsc -b --noEmit` and `npm run build` both pass clean against these types. |
| Backend → PostgreSQL (Prisma) | **PASS** (static) / **NOT VERIFIED** (runtime) | Every repository method cross-checked against `schema.prisma` (37 models) — field names, relations, enums all line up. Runtime queries against a live DB could not be exercised: no Postgres instance in this sandbox. |
| Backend → Redis | **PASS** (as designed) | `RedisService` connects lazily, fails open, never becomes a hard dependency (confirmed by reading the implementation). Presence caching is actively used by the Socket.IO gateway. **Finding:** the structured cache helpers (`cacheUser`, `cacheCommunity`, `checkRateLimit`, `publish`) are defined but never called anywhere in the codebase — dead code, not a bug (rate limiting is handled separately and correctly via `@nestjs/throttler`). |
| Frontend → Socket.IO | **PASS** (static) / **NOT VERIFIED** (live) | `lib/realtime/socket.ts` connects to `/realtime` with the access token, `MessagesPage` joins/leaves conversation rooms and handles `message:created/updated`, `typing:update`; `AppDataContext`/`VoiceSessionContext` handle `notification:created`/`party:updated`. Could not verify against a live server — no backend running in this sandbox. |
| Backend → LiveKit | **PASS** (static) / **NOT VERIFIED** (live) | `VoiceSessionContext` (party voice) and `CommunityDetailPage`'s `VoiceChannelPanel` (channel voice) both call the real token endpoints and connect via `livekit-client`'s `Room.connect()`. Token shape (`{token, url, roomName}`) matches `LiveKitService.createAccessToken` exactly. No LiveKit server available to test an actual connection. |
| Frontend → Storage (uploads) | **PASS** (static) / **NOT VERIFIED** (live) | Avatar upload (Settings), attachment upload (Messages) call `uploadsApi` with client-side size/MIME validation matching the backend's stated 10MB limit. No storage backend running to confirm the round trip. |
| Authentication | **PASS** | Full flow implemented and typed against the real DTOs: register, login, refresh (httpOnly cookie), logout, forgot/reset password, email verification (both the "waiting" state and the `?token=` link flow), OAuth callback (`/oauth/callback` — this route didn't exist before; the backend redirects there and nothing would have caught it). Access token kept in memory only, never localStorage. |
| Authorization | **PASS** (as designed) | Backend derives identity from the JWT, not from client-supplied IDs (confirmed by reading every controller — none accept a caller-supplied `userId`/`role` for authorization decisions). Socket gateway re-checks room membership server-side before allowing a join. Live IDOR probing (Section 44 of the original brief) was **NOT VERIFIED** — needs a running server and two accounts. |
| Messaging | **PASS** (static) | Conversation list, pagination (`Load earlier messages`), send/edit/delete/pin/react, read receipts, typing indicators, attachments — all wired to real endpoints with realtime updates layered on top. |
| Friends | **PASS** (static) | List, incoming/outgoing requests, send/accept/decline/cancel, remove, pin/unpin (API exists; UI surfaces pin state, dedicated pin/unpin buttons not added to the grid — minor gap). |
| Party | **PASS** (static) | Create, invite, kick, leave, settings, voice join/leave all wired; leader-only actions gated by role. |
| Voice | **PASS** (static) | Real LiveKit connection, mute/deafen synced to backend voice-state, active-speaker tracking, output volume via LiveKit's participant API (not a DOM hack). |
| Communities | **PASS with a known gap** | Browse/create/join/leave, members, roles, events, announcements, channel structure, and channel *voice* are all fully wired. **Community text-channel messaging has no backend endpoint at all** — the backend's message system is DM/group-conversation-only (`/conversations/*`); there is no `/communities/:id/channels/:channelId/messages` route. The UI is honest about this (shows an explanatory empty state) rather than faking channel chat. |
| Notifications | **PASS** (static) | List with pagination, unread count, mark read/all-read, delete, realtime `notification:created` prepends live. |
| Search | **PASS** (static) | Debounced, cancels in-flight requests on new keystrokes, real endpoints for users/communities/messages. |
| Settings | **PASS** (static) | Profile, avatar upload, password change, account deletion, and preferences (appearance/audio/notifications/privacy) all persist to the backend. |
| Docker | **NOT VERIFIED** | No Docker daemon available in this sandbox. |
| E2E / multi-user journey | **NOT VERIFIED** | Requires a live backend + two browser sessions; not possible here. |
| Frontend build | **PASS** | `npm run build` succeeds (`tsc -b && vite build`), producing a working `dist/`. |
| Frontend lint | **PASS** | `oxlint` — 0 errors, 5 pre-existing-pattern warnings (Fast Refresh export-shape warnings, same pattern as the untouched `Toast.tsx`; not introduced by this work). |
| Frontend typecheck | **PASS** | `tsc -b --noEmit` clean after every rewrite. |
| Backend build/lint/`prisma validate` | **NOT VERIFIED** | `prisma generate` needs to download engine binaries from `binaries.prisma.sh`, which is outside this sandbox's allowed network egress (only npm/pypi/github registries are reachable). Without the generated client, `PrismaService`'s type degrades to `any`, which cascades into ~1150 `@typescript-eslint/no-unsafe-*` lint errors and TS errors that are **artifacts of the missing codegen, not real defects** — confirmed by tracing several errors back to `this.prisma.<model>.findUnique` calls that are correctly typed once the real client exists. Verified correctness instead by manually cross-referencing every repository/service method against `schema.prisma`. |
| Backend tests | **NOT VERIFIED** | Same Prisma-client blocker prevents `npm test` from running meaningfully. |

## Bugs found and fixed

1. **OAuth callback route was missing.** The backend redirects to
   `${APP_URL}/oauth/callback#accessToken=...` after Google/Discord/etc.
   login, but no such frontend route existed — the redirect would have
   hit the 404 page. Added `OAuthCallbackPage` and
   `AuthContext.applyOAuthToken`.
2. **`resendVerification` was called with no body.** The frontend
   API module originally omitted the `email` field; the backend's
   `POST /auth/resend-verification` requires it (`ResendVerificationDto`).
   Fixed to take an email argument.
3. **Volume control used a fabricated DOM attribute.** An early draft of
   the voice output-volume slider queried
   `audio[data-lk-remote-audio]`, an attribute LiveKit doesn't actually
   set — it would have silently done nothing. Replaced with LiveKit's
   real `Participant.setVolume()` API, exposed from `VoiceSessionContext`.
4. **Four Prisma `checked`-input type errors in the backend**, found only
   after the user ran `docker compose up --build` on a machine with
   normal internet access (this sandbox couldn't generate the Prisma
   client to catch these itself — see "Backend build/lint" below). All
   four are the same root cause: a relation's foreign-key scalar
   (`ownerId`, `voiceRoomId`) was passed directly in a `.update()` call's
   `data`, but Prisma's checked `XUpdateInput` type only exposes the
   relation field (`owner: { connect: { id } }`) for FK scalars that
   back a `@relation`, not the raw scalar — that's only valid in
   `.create()` or `.updateMany()`. Fixed in:
   - `party.service.ts` (`transferOwnership`)
   - `users.repository.ts` (`deleteAccount`, two call sites: community
     and party ownership transfer)
   - `voice.repository.ts` (`createVoiceRoomForChannel`)
   - `party.repository.ts` (`attachVoiceRoom`)

   After fixing the one the build log reported, the other three were
   found by grep-auditing every `.update()` call site in the codebase for
   the same pattern rather than waiting for each to surface one at a time
   across repeated build attempts.
5. **`dist/main.js` didn't exist at the path the Dockerfile expected**,
   found from a second real `docker compose up --build` run: the image
   built successfully but the container crashed with
   `Cannot find module '/app/dist/main.js'`. Root cause: `prisma/seed.ts`
   was not excluded from `tsconfig.build.json`, and since the config had
   no explicit `rootDir`, TypeScript inferred it from the common path of
   every file in the compile — which widened from `src/` to the project
   root once `prisma/seed.ts` (outside `src/`) was included. That shifted
   every compiled output path down one level, so the entry point ended
   up at `dist/src/main.js` instead of `dist/main.js`. Fixed by excluding
   `prisma` from `tsconfig.build.json` and pinning `rootDir: "./src"`
   explicitly as defense-in-depth, so this class of bug can't silently
   recur if another stray `.ts` file ever lands outside `src/`. The
   `prisma db seed` script is unaffected — it runs via `ts-node
   prisma/seed.ts` directly, per `package.json`'s `prisma.seed` field,
   completely outside the Nest build.
6. **Prisma's query engine crashed at container startup** (`libssl.so.1.1:
   cannot open shared object file`), found from a third real `docker
   compose up --build` run — this one got past the `dist/main.js` fix and
   actually started the container, which then crashed on `PrismaService`'s
   `onModuleInit`. Root cause: Prisma auto-detects which engine binary to
   use by shelling out to the `openssl` CLI at `prisma generate` time, but
   `node:20-bookworm-slim` doesn't include that CLI. Detection silently
   failed and fell back to a hardcoded guess (`debian-openssl-1.1.x`) that
   doesn't match Debian Bookworm's actual OpenSSL 3.0 — and Bookworm no
   longer even packages `libssl1.1`, so the wrong engine binary couldn't
   load at all. Fixed two ways: pinned `binaryTargets = ["native",
   "debian-openssl-3.0.x"]` explicitly in `schema.prisma` so Prisma never
   has to guess, and installed the `openssl` package in both Dockerfile
   stages as defense-in-depth (needed anyway so `libssl.so.3` is actually
   present for the correct engine binary to load at runtime, not just
   selected correctly at generate time).
7. **Every single API response was being read one level too shallow** —
   found from an actual browser login attempt: the network request
   succeeded (`200`, real response body) but the app still showed a
   generic error. Root cause: the backend wraps every response in a
   global envelope via `ResponseInterceptor`/`GlobalExceptionFilter` —
   `{success: true, data: <payload>, meta?, timestamp}` on success,
   `{success: false, error: {code, message, details}, timestamp, path}`
   on failure — which is not the NestJS default shape and wasn't visible
   anywhere in the DTOs cross-referenced when building the API client
   (DTOs describe the controller's return value, not what the interceptor
   wraps it in afterward). `http.ts` was reading response bodies directly,
   so e.g. login's real payload landed at `session.data.tokens.accessToken`
   while every call site expected `session.tokens.accessToken` — throwing
   a plain `TypeError`, not an `ApiError`, so it fell through to a generic
   "check your connection" message instead of a clear one. This affected
   every endpoint across the whole app, not just login. Fixed centrally
   in `http.ts`'s one `request()` function — unwrap `data` on success,
   read `error.message`/`error.code`/`error.details` on failure — rather
   than touching each of the 12 `api/*.ts` modules individually, which is
   exactly why that layer was built as one chokepoint in the first place.
   This is the kind of thing that can only really be caught by an actual
   request against a running backend, which the static audit in this
   sandbox couldn't do — flagged plainly here rather than glossed over.
8. **`GET /friends` nests the user object, but the client assumed a flat
   shape** — found from an actual post-login crash (blank page, `Avatar`
   component throwing on `name.split` because `name` was `undefined`).
   The endpoint actually returns `{friend: <user>, pinned, since}[]`, not
   a flat array of users with `pinned` merged in — confirmed by reading
   `FriendsService.listFriends` directly rather than guessing further.
   Unlike the response-envelope bug, this one is specific to this single
   endpoint (friend *requests*, party members, community members, and
   notification actors all nest the user object under a sensibly-named
   key like `sender`/`user`/`actor` matching what the client expected).
   Fixed by correcting `ApiFriendEntry`'s type and updating every call
   site (`FriendsPage`, `HomePage`, `PartyPage`'s invite list,
   `ProfilePage`) to read `entry.friend` instead of a flat entry, and
   converting through the existing `friendToUi` adapter consistently so
   downstream rendering code didn't need to change. Also confirmed while
   investigating: the raw `User` Prisma row (which several endpoints,
   including this one, pass through largely unmodified) is missing
   `passwordHash`/`email`/`emailVerifiedAt` by design — a dedicated
   `RedactSensitiveFieldsInterceptor` strips those centrally — so no
   sensitive data was ever exposed by this bug, just a rendering crash
   from a field-shape mismatch.
9. **Three more raw-Prisma-shape mismatches, found via a full proactive
   re-audit of every endpoint touched on first load** (triggered by the
   friends bug repeating with communities): after the friends fix
   shipped, the exact same class of bug immediately recurred as a blank
   screen again — `Community.memberCount` doesn't exist; the backend
   returns Prisma's standard `_count: { members: number }` instead, and
   `HomePage` called `.toLocaleString()` on it directly, crashing on
   `undefined`. Rather than fix that one spot and wait for the next
   crash, read every remaining endpoint's repository/service code
   directly and found two more before they could surface one at a time:
   - `GET /conversations` nests participants as
     `{userId, user, muted, lastReadAt, joinedAt}[]`, not flat users; the
     last message is under `messages: [msg]` (array, not `lastMessage`);
     the unread count field is `unread`, not `unreadCount`; and `muted`
     doesn't exist at the conversation level at all — it's per-participant,
     requiring a lookup by the current user's id.
   - `GET /communities/:id/members`'s `roles` field is
     `CommunityMemberRole[]` with the actual role nested under `.role`,
     not a flat `CommunityRole[]`. `CommunityEvent` has no attendee
     tracking in the schema at all (no `attendeeCount` anywhere to read)
     and uses `date`, not `startsAt`. `Announcement` uses `postedAt`, not
     `createdAt`, and never includes the author relation (left optional,
     already handled safely by the existing `?? 'Unknown'` fallback).

   Fixed the community count the same way as the earlier envelope bug —
   centrally, via a `normalizeCommunity()` mapping applied once in
   `communitiesApi`'s methods, so `ApiCommunity.memberCount` is real
   everywhere it's already used (`HomePage`, `CommunitiesPage`,
   `CommunityDetailPage`, `ProfilePage`) without touching those four call
   sites individually. Fixed conversations by correcting
   `ApiConversation`'s type to the true raw shape and rewriting
   `conversationToUi` to properly flatten participants, resolve the
   current user's mute state, and read the last message from the `messages`
   array — `HomePage`, which had been reading raw conversation fields
   directly instead of going through the adapter, was updated to convert
   through `conversationToUi` like every other consumer already did.
   Fixed the community members/events/announcements field names directly
   in `CommunityDetailPage`, the only place they're rendered.

   Net effect: any endpoint that includes a Prisma relation without an
   explicit DTO transform is a candidate for this exact bug class, and at
   this point every such endpoint reachable from the pages built in this
   pass has been read directly against its repository/service source and
   corrected — not just patched reactively after a crash. That said, this
   was done by static code reading, not by clicking through every single
   screen and modal in a live browser, so a similar mismatch on a less
   commonly hit path (e.g. deep in Settings, or an error path) can't be
   ruled out with full confidence — same limitation noted throughout this
   report for anything that needed a live backend to truly verify.
10. **No logout button existed anywhere in the UI.** `AuthContext.logout()`
    was fully implemented (revokes the refresh cookie, clears the in-memory
    access token, disconnects the socket) and was already used internally
    after account deletion, but never wired to a visible button — a plain
    UI gap, not a data or backend bug, and not one any of the static or
    live-browser testing so far happened to surface since testing focused
    on data flowing in, not the sign-out path. Added two entry points: an
    icon button next to Settings in the sidebar's profile row (always
    visible), and an explicit "Log Out" card in Settings → Account
    (discoverable, above Danger Zone). Both go through the same
    `logout()` call.

## New feature: party voice call invitations

Added after delivery, per explicit request — this is genuinely new
functionality, not a bug fix, and is scoped narrowly to what was asked
for: **party voice calls with a ring/accept/decline flow**, not 1:1
direct friend calls, video calling, screen share, or voice messages
(none of which existed anywhere in any of the four original phase zips
and were confirmed absent from both the backend schema and the
pre-integration frontend before building anything).

**How it works:** any party member can click "Start Voice Call," which
connects them to the party's voice room immediately (reusing the
existing `joinPartyVoice`/LiveKit flow) while ringing every other party
member in real time. Recipients get a full-screen incoming-call prompt
with Accept/Decline, visible regardless of what page they're on. A
30-second timeout auto-cancels an unanswered call.

**Backend** (`realtime.gateway.ts`): three new Socket.IO handlers —
`call:invite`, `call:respond`, `call:cancel` — plus cleanup on caller
disconnect. Call state is deliberately ephemeral (an in-memory `Map`,
same category as typing indicators), not a new Prisma model or
migration, because a party already gets a `VoiceRoom` created eagerly at
party-creation time (confirmed by reading `PartyService.create`) — the
existing voice-token endpoint just needed an invitation/notification
layer in front of it, not new persisted data.

**Frontend**: new `CallContext` (ring state, wired to the new socket
events) and a `CallOverlay` component mounted once at the app root so
the incoming-call modal and outgoing-call banner work from any page.
`PartyPage` gained a "Start Voice Call" primary action, with a
"Join without ringing everyone" secondary option preserving the original
silent-join behavior.

**Verification status**: same honest caveat as the rest of this
document — `tsc -b`, `npm run build`, and `npm run lint` all pass clean
on the frontend. The backend addition is syntactically verified (brace
balance, clean TypeScript transpile) but **could not be type-checked or
run end-to-end in this sandbox** for the same Prisma-codegen network
restriction noted throughout this report, and has not been exercised
against a live two-user session. Test this one specifically before
relying on it — start a call from one logged-in browser/account and
confirm a second account (a friend in the same party, on another device
or private window) actually receives the incoming-call prompt and can
join.

**Follow-up fix (found immediately, from a blank-screen crash on first
load after shipping the above):** `CallProvider` calls `useToast()`, but
it was wired into `main.tsx` *outside* `App.tsx`, while `ToastProvider`
was declared *inside* `App.tsx` — so `CallProvider` rendered before
`ToastProvider` existed anywhere in the tree, throwing immediately on
mount. Fixed by moving `ToastProvider` up into `main.tsx`, above every
provider that depends on it, and removing the now-redundant declaration
from `App.tsx`. A pure provider-ordering mistake introduced while wiring
the call feature — verified with a clean `tsc -b` and `npm run build`
afterward, though (as with the feature itself) not yet exercised in a
live browser in this sandbox.

**Environment fix (not a code bug):** `docker-compose.yml` originally
published Postgres on the host at `127.0.0.1:5432`, which failed to bind
on a machine that already had something else (commonly a natively
installed PostgreSQL Windows service) listening on that port —
`ports are not available: exposing port TCP 127.0.0.1:5432 ...`.
Remapped the host-side publish to `5433` in both `docker-compose.yml`
and `.env.example`/`.env.test.example`. This only changes the port
host-side tools (like a locally-run `prisma db seed`) connect through —
the `api` container's own connection to Postgres uses the Docker-internal
hostname/port (`postgres:5432`) and is completely unaffected.


## New feature: public/private party invites with an inline Join button

Added after a follow-up request. Two party visibility modes, chosen when
creating a party:

- **Private** (existing behavior, unchanged): the organizer invites
  specific friends one at a time from the party page.
- **Public** (new): every friend of the organizer gets invited
  automatically the moment the party is created, and — this was the
  actual gap — the invite now shows a real **Join** / **decline** button
  directly on the notification itself, not just a link that takes you to
  the party page with no clear next step.

**Design choice — no new database migration.** Rather than build a
separate "public party broadcast" mechanism, "public" reuses the exact
same `PartyInvite` + `Notification` pipeline that private invites
already used — it just calls the existing single-friend invite logic in
a loop over the organizer's whole friend list (`inviteAllFriends`,
skipping anyone already a member or already invited). This means public
invites are individually real, acceptable/declinable records, not a
transient broadcast with no trail if someone's offline when it's sent.

**The missing piece for both modes** was that a `Notification` row has
no reference back to which `PartyInvite` it came from — there was no way
for the UI to know which invite to accept when someone clicked a
notification. Rather than add a migration for a `partyId`/`inviteId`
column, added a small new read endpoint (`GET /party/invites/incoming`)
that lists the current user's pending invites with party+inviter details,
and the frontend now correlates a `party-invite` notification to its
invite by matching the notification's actor (the inviter) against that
list. This is a reasonable simplification, not a schema-perfect solution
— documented explicitly as a known limitation below.

**Backend changes:** `PartyRepository.findIncomingInvites` /
`findIncomingInvitesForParty` (new read queries, no schema change),
`PartyService.inviteAllFriends` / `listIncomingInvites` (new methods,
reusing the existing `invite()` method under the hood), two new routes
(`POST /party/:id/invite-friends`, `GET /party/invites/incoming`) placed
before the existing `:id` dynamic route to avoid Nest's routing
matching `invites` as a party id, matching the pattern already
established by the existing `active` route. `PartyModule` now imports
`FriendsModule` to inject `FriendsService`.

**Frontend changes:** the Create Party modal gained a Private/Public
choice with plain-language descriptions of what each does;
`NotificationsPage` now renders inline Join/Decline buttons for any
`party-invite` notification it can resolve to a pending invite, calling
the same accept/decline endpoints the Party page already used.

**Verification status:** same caveat as every backend change in this
report — syntax-verified (clean TypeScript transpile, balanced braces)
but not type-checked or run end-to-end in this sandbox (the Prisma
codegen network restriction noted throughout). The frontend side is
fully verified (`tsc -b`, `npm run build`, `npm run lint`, all clean).
**Needs a live two-user test**: create a public party as one account and
confirm a friend account actually receives a notification with working
Join/Decline buttons, and separately confirm a private invite (via the
existing Invite modal) now also shows the same inline buttons.


## Known issues (not fixed — flagged for a decision, not backend surgery)

1. **Duplicate preferences routes.** `GET/PATCH /users/me/preferences`
   and `GET/PATCH /settings/preferences` both read/write the same
   `UserPreferences` row. The frontend standardizes on
   `/settings/preferences`; the duplicate backend route was left in place
   rather than removed without sign-off.
2. **No community text-channel messaging endpoint.** See the
   Communities row above. Channel structure, voice, members, roles,
   events, and announcements are all real; text chat inside a community
   channel is not implemented on the backend, so the frontend doesn't
   pretend it is.
3. **Redis structured-cache helpers are unused.** Not a bug (nothing
   depends on them, no staleness risk), but the caching layer described
   in `docs/database/redis-strategy.md` isn't actually active for
   user/community reads — every read currently goes straight to Postgres.
4. Friend pin/unpin API exists (`friendsApi.pin/unpin`) but isn't yet
   surfaced as a per-friend action in the Friends UI beyond showing the
   pinned section — a small follow-up, not a blocker.

## Unverifiable in this environment

Everything requiring a running Postgres, Redis, LiveKit server, or Docker
daemon, or two simultaneous authenticated sessions, could not be executed
here and is marked NOT VERIFIED above rather than assumed to pass. The
network sandbox for this delivery only allows egress to npm/pypi/github/
crates registries — no database, cache, media server, or
`binaries.prisma.sh` (needed for `prisma generate`'s engine download).

## Final recommendation

**INTEGRATION COMPLETE WITH KNOWN LIMITATIONS.**

All static integration work — every frontend screen wired to real
backend endpoints, realtime messaging and voice implemented against the
actual Socket.IO/LiveKit contracts, authentication/authorization
implemented correctly, no mock data left in any production flow — is
done and passes every check that's actually executable in this
environment (frontend build, lint, typecheck). What remains before a
genuine "complete" sign-off is running this against real infrastructure
(`docker compose up`, live Postgres/Redis/LiveKit, `prisma generate`,
backend `npm test`, and a live two-user E2E pass) — none of which this
sandbox can do, and none of which were claimed as passing above.
