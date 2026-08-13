# Schema, relationships, and indexing

## Delete strategy by relationship

The rule applied throughout: **cascade only when the child row has no
meaning without the parent, and no one else depends on it.** Everything
else is `Restrict` (block the delete, forcing an explicit decision) or
`SetNull` (the reference is optional context, not the row's reason to
exist).

| Relationship | Behavior | Why |
|---|---|---|
| `User` → owned `Community` | **Restrict** | A community has other members whose channels, roles, messages, and history must not vanish because the owner's account was deleted. Ownership is transferred (or the community deleted only if the owner was the sole member) by `UsersRepository.deleteAccount` **before** the user row itself is ever touched — see [deletion-strategy.md](./deletion-strategy.md). The FK is a safety net that should never actually fire in normal operation. |
| `User` → owned `Party` | **Restrict** | Same reasoning as Community. |
| `Community` → `CommunityMember`/`CommunityRole`/`ChannelGroup`/`Channel`/`CommunityEvent`/`Announcement` | **Cascade** | These have no meaning without their community, and deleting a community is itself an explicit, rare, owner-initiated action. |
| `Party` → `PartyMember`/`PartyInvite` | **Cascade** | Same reasoning. |
| `Conversation` → `ConversationParticipant`/`Message` | **Cascade** | A conversation being deleted (e.g. both DM participants leaving) should take its messages with it. |
| `Message` → `MessageAttachment`/`MessageReaction` | **Cascade** | Attachments/reactions have no independent meaning. |
| `Message.replyToId` → `Message` | **SetNull** | Deleting the original message shouldn't cascade-delete every reply to it — the thread survives with a dangling-but-harmless "original message unavailable" reply pointer. In practice messages are soft-deleted (see below) so this mostly matters for direct DB-level deletes. |
| `Notification.actorId` → `User` | **SetNull** | The notification ("X accepted your friend request") should survive even if the actor later deletes their account; `actorId` is context, not the reason the notification exists. `recipientId` is **Cascade** — a notification has no meaning without its recipient. |
| Everything else FK'd straight to `User` (sessions, tokens, oauth accounts, uploads, friend requests/friendships/blocks, conversation participation, party/community membership, reactions) | **Cascade** | These are all "belongs to this user" rows the account soft-delete flow doesn't need to touch — see below. |

## Soft delete: where and why

Two models use `deletedAt` instead of (or in addition to) hard delete:

- **`User.deletedAt`** — account deletion never hard-deletes the row (see
  [deletion-strategy.md](./deletion-strategy.md)). PII is scrubbed, the row
  and its id remain, so every other user's message history, friendships,
  and community membership records stay intact and referentially valid.
- **`Message.deletedAt`** — `MessagesRepository.deleteMessage` clears
  `content` and sets `deletedAt` rather than issuing `DELETE`. This keeps
  reply threads intact (no orphaned `replyToId` pointers) and preserves a
  moderation/audit trail. All read paths (`listMessages`, `searchMessages`,
  the last-message preview in `listConversationsForUser`) filter
  `deletedAt: null`; `findMessageById` intentionally does not, so
  moderation tooling can still look a deleted message up by id.

Nothing else uses soft delete — communities, parties, and their child
records are hard-deleted on an explicit, owner-initiated delete action,
per the "don't add soft deletion everywhere" guidance; there's no
restoration/audit requirement for those today.

## Index inventory and rationale

Every index below exists because a repository method issues the query
shape it serves — see `docs/database/query-guidelines.md` for where.

| Table | Index | Serves |
|---|---|---|
| `User` | `email` (unique), `handle` (unique) | Login lookup, handle-uniqueness checks |
| `User` | `email`, `handle` (plain btree, in addition to the unique index) | `contains`/`ILIKE` prefix-style search in `UsersRepository.search` — the unique index alone still works for exact-match lookups; these plain indexes exist for the search path specifically, matching the original design's intent |
| `User` | `createdAt` | Admin/analytics "users over time" queries (section 5 requirement; no current endpoint uses it yet, but it's a near-zero write cost to have ready) |
| `User` | `deletedAt` | Filtering tombstoned accounts out of search/lookups (`WHERE deletedAt IS NULL` on a mostly-null column — Postgres handles this efficiently) |
| `Session` | `userId`, `expiresAt` | `listSessions`/session lookups by user; `expiresAt` for the expired-session cleanup job (there's no cleanup job wired up yet — this index is prep for one, see backup-and-recovery.md's "housekeeping" note) |
| `EmailVerificationToken`, `PasswordResetToken` | `userId`, `expiresAt` | Token lookup by user; `expiresAt` for cleanup |
| `FriendRequest` | `(receiverId, status)` composite | "my pending friend requests" — filters on both columns together |
| `Friendship` | `userAId`, `userBId` | Friend list lookups from either side of the (deterministically-ordered) pair |
| `ConversationParticipant` | `userId` | `listConversationsForUser`'s `participants: { some: { userId } }` |
| `Message` | `(conversationId, createdAt)` composite | Message history pagination — this is the hot path index |
| `Message` | `authorId` | Moderation / "all messages by this user" audit queries (no endpoint yet; explicitly called out in the spec as an important index area) |
| `Party` | `ownerId`, `createdAt` | Was **missing entirely** before this phase — added for owner lookups and any future "recent parties" listing |
| `PartyMember` | `userId` | "which parties am I in" |
| `PartyInvite` | `inviteeId` | "my pending invites" |
| `Community` | `ownerId` | Owner lookups (e.g. the account-deletion flow's `findMany({ where: { ownerId } })`) |
| `CommunityMember` | `userId`, `(communityId, status)` composite | "my communities" and `listMembers`/`listForUser`'s combined community+status filter |
| `CommunityRole`, `ChannelGroup`, `Channel` | `communityId`/`channelGroupId` | Standard parent-lookup indexes |
| `CommunityEvent` | `(communityId, date)` composite | Upcoming-events listing sorted by date within a community |
| `Announcement` | `(communityId, postedAt)` composite | Same pattern for announcements |
| `Notification` | `(recipientId, read)`, `(recipientId, createdAt)` | Unread-count and chronological notification feed |
| `Upload` | `userId` | "my uploads" |

### Composite unique constraints (duplicate prevention at the DB level)

All of these exist as `UNIQUE` indexes, not just application checks — see
`test/database/schema-constraints.integration-spec.ts` for tests that
verify each one is actually enforced by Postgres:

- `User(email)`, `User(handle)`
- `OAuthAccount(provider, providerUserId)`
- `FriendRequest(senderId, receiverId)`
- `Friendship(userAId, userBId)` — pair is always stored in a deterministic
  order (lower id first) so `(A,B)` and `(B,A)` can't both be inserted
- `Block(blockerId, blockedId)`
- `ConversationParticipant(conversationId, userId)`
- `MessageReaction(messageId, userId, emoji)`
- `PartyMember(partyId, userId)`
- `CommunityMember(communityId, userId)`
- `CommunityMemberRole(communityMemberId, roleId)`
- `Party(voiceRoomId)`, `Channel(voiceRoomId)` — a voice room belongs to at most one party or channel

## What was deliberately *not* added

- **No new tables "because they sound useful."** Every table in the
  schema is backed by a concrete frontend/backend need traced during the
  audit (section 26).
- **No sharding or partitioning implemented.** `Message` is the one table
  that will eventually need partitioning (by `conversationId` range or by
  time). It's designed so that's possible later — no natural-key
  dependencies that would block it — but implementing it now would be
  premature per the spec's explicit guidance.
- **No cursor-pagination migration for the public messages API** — see
  `query-guidelines.md` for why offset pagination was kept for now.
