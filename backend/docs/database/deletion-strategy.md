# Deletion strategy

## The problem this fixes

Before this phase, `Community.ownerId` and `Party.ownerId` were
`onDelete: Cascade`, and there was **no account-deletion endpoint at all**.
Had one been added naively (`prisma.user.delete(...)`), it would have
cascade-deleted every community and party the user owned — including all
of every *other* member's messages, roles, channels, events, and
membership history — as a side effect of one person closing their
account. There was also no protection against this: nothing in the schema
or application code would have stopped it.

## The fix

1. **`Community.owner` and `Party.owner` are now `onDelete: Restrict`.**
   Postgres will refuse to hard-delete a `User` row while they still own a
   community or party. This is a safety net, not the primary mechanism —
   see `test/database/schema-constraints.integration-spec.ts`'s "blocks
   hard-deleting a user who still owns a community or party" test, which
   confirms Postgres actually enforces this.

2. **Account deletion is a soft delete, and it's now implemented**
   (`UsersRepository.deleteAccount`, called from
   `UsersService.deleteAccount`, exposed as `DELETE /api/v1/users/me`).
   Inside a single Prisma transaction:
   - All the user's sessions are revoked.
   - For each community they own: if another **active** member exists,
     ownership transfers to whoever joined earliest; otherwise (they were
     the sole member) the community is deleted outright — nothing else
     depends on it.
   - For each party they own: same pattern, transferring the `LEADER`
     role along with ownership, or deleting the party if they were the
     only member. If the party is deleted and had a voice room, its
     LiveKit name is returned to the caller so the room can be closed
     *after* the transaction commits — a call to an external service
     doesn't belong inside a DB transaction.
   - The `User` row itself is **not** deleted. Its PII is scrubbed
     (`displayName` → "Deleted User", `handle`/`email` → a tombstone value
     derived from the user's id so uniqueness constraints are trivially
     satisfied, `passwordHash`/`avatarUrl`/`bio`/`statusText`/`currentGame`
     → `null`, `status` → `OFFLINE`) and `deletedAt` is set.

   Why keep the row instead of hard-deleting: every message, reaction,
   friendship, and community/party membership record any other user can
   see references this row by `userId`. Hard-deleting it would either
   cascade-destroy other users' data (the exact problem above) or require
   auditing and rewriting dozens of FKs to `SetNull`, which would corrupt
   the historical record of who sent what. A soft-deleted, anonymized row
   is the standard, low-risk answer.

3. **Search and public-profile lookups exclude tombstoned accounts**
   (`UsersRepository.search` filters `deletedAt: null`), and login already
   fails naturally once `passwordHash` is cleared.

## What's intentionally out of scope here

- **Hard deletion / GDPR "right to erasure" workflows** (e.g. a delayed
  background job that eventually scrubs even more, or purges the row
  after a retention window with all FKs pointed elsewhere) — this is a
  product/legal decision, not a database-correctness one, and belongs in
  Phase 4 or a dedicated compliance task.
- **Admin-initiated moderation bans/deletes** — the same transaction
  shape would apply, but there's no admin role/permission system yet to
  gate it.
