# Query guidelines

## N+1 queries found and fixed

`MessagesRepository.listConversationsForUser` computed each conversation's
unread count with a separate `prisma.message.count()` call inside a
`Promise.all` loop — one query per conversation. Fixed to a single
aggregate query:

```sql
SELECT cp."conversationId", COUNT(m.id)
FROM "ConversationParticipant" cp
JOIN "Message" m ON m."conversationId" = cp."conversationId"
  AND m."authorId" != $userId AND m."deletedAt" IS NULL
  AND m."createdAt" > COALESCE(cp."lastReadAt", to_timestamp(0))
WHERE cp."userId" = $userId AND cp."conversationId" = ANY($conversationIds)
GROUP BY cp."conversationId"
```

This is the only N+1 found in the audited repositories — the rest either
already use `include`/nested writes for related data in one round trip, or
operate on a single row.

## Pagination

- **Messages** (`GET /conversations/:id/messages`) keep the existing
  `page`/`limit` offset-pagination contract — this is a deliberate,
  non-breaking choice; see "Why offset pagination stayed" below.
- Every list endpoint's `limit` is capped (`PaginationQueryDto`, max 100),
  so nothing does an unbounded `SELECT *`.
- `Message(conversationId, createdAt)` is indexed, so even the offset path
  is an index scan, not a sequential scan, at the depth the UI actually
  paginates to.

### Why offset pagination stayed

The spec calls for cursor-based (`createdAt`+`id`) pagination for
high-volume message history. That's the right answer at large scale, but
the existing frontend was built against `page`/`limit` query params and a
`{ items, total, page, limit }` response shape (`paginate()` in
`common/dto/pagination.dto.ts`). Switching to `before`/`after` cursor
params now would be a breaking API change for no functional gain yet — at
current scale (capped at 100/page, indexed) offset pagination is fine, and
the spec itself allows this ("offset pagination is appropriate ... do not
use it blindly", not "never use it").

**Migration path, when it's needed:** add optional `before`/`after`
message-id query params to `GET /conversations/:id/messages`, additive to
`page`/`limit` (old clients keep working), and have the repository prefer
a keyset query (`WHERE conversationId = $1 AND (createdAt, id) < ($2, $3)
ORDER BY createdAt DESC, id DESC LIMIT $4`) when a cursor is present. This
is a non-breaking follow-up, not a Phase 3 blocker.

## Transactions

Wrapped in `prisma.$transaction` (previously separate, non-atomic calls):

| Operation | Why it needs to be atomic |
|---|---|
| `FriendsRepository.acceptRequestAtomic` | Status flip + friendship creation must succeed or fail together — otherwise a request can end up `ACCEPTED` with no friendship row |
| `PartyRepository.respondInviteAtomic` | Invite response + member creation together — otherwise an invite can be marked accepted with no membership row |
| `CommunitiesRepository.create` | Community + owner membership + roles + channels + founder-role assignment were previously two separate operations (the nested `create` and a follow-up query+create for the founder role) — now one transaction |
| `CommunitiesRepository.addMember` | Membership + default-role assignment |
| `UsersRepository.deleteAccount` | See `deletion-strategy.md` — the whole ownership-transfer + anonymize sequence |

Not wrapped: single-row creates/updates, and `PartyRepository.create`
(party + owner membership is one nested Prisma `create` call, already
atomic — the separate `attachVoiceRoom` follow-up call was removed
entirely by passing `voiceRoomId` directly into the same `create`).

## Concurrency / race conditions

Prisma's `PrismaClientKnownRequestError` (`P2002` unique-constraint
violations) is already converted to a clean `409 Conflict` by
`GlobalExceptionFilter` — races that hit a unique constraint were never
crashing with a raw 500, even before this phase.

What *was* missing was atomicity of multi-step state transitions, which
the transactions above fix:

- **Double-accepting a friend request**: `acceptRequestAtomic`'s
  `updateMany({ where: { id, status: PENDING }, ... })` only matches (and
  returns a non-zero count) for the request that wins the race; the loser
  gets a clean `ConflictException` instead of silently double-processing.
- **Double-responding to a party invite**: same pattern with
  `respondedAt: null` as the condition.
- **Joining a full party / duplicate community or party membership**: the
  unique constraints (`PartyMember(partyId, userId)`,
  `CommunityMember(communityId, userId)`) are the actual backstop; the
  service-layer check-then-act in `CommunitiesService.join` and
  `PartyService.invite`'s max-size check are best-effort pre-checks, and a
  concurrent double-join surfaces as a 409 via the constraint, not
  corrupted data.

## `select` vs full-record fetches

The audited repositories already use targeted `include`s rather than
fetching unrelated relations, and none of the reviewed queries pull
unbounded child collections without a `take`. No changes were needed here
beyond the N+1 fix above.
