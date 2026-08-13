/**
 * DB-level constraint tests — run directly against Postgres via the `pg`
 * driver, deliberately NOT going through `@prisma/client`.
 *
 * Why: Prisma's query engine binary is fetched from binaries.prisma.sh at
 * `prisma generate` time. In an environment where that host is blocked,
 * `@prisma/client` cannot be generated, so repository/service-level tests
 * (which import it) cannot run there either. These tests exercise the same
 * critical behaviors from the DB side — the actual SQL constraints created
 * by prisma/migrations/20260808000000_init/migration.sql — so the schema's
 * correctness can still be verified end-to-end without the Prisma CLI.
 *
 * Once `prisma generate` can run (locally, in CI, or after this sandbox's
 * network allowlist includes binaries.prisma.sh), the equivalent — and
 * more complete — coverage belongs in Prisma-based repository specs
 * (`*.repository.spec.ts`) that exercise the actual application code, not
 * just the schema. See docs/database/testing.md for both approaches and
 * why we keep this suite even after that's possible: it's a fast,
 * dependency-free guardrail against a migration changing a constraint by
 * accident.
 *
 * SAFETY: refuses to run against anything whose connection string doesn't
 * look like a test database.
 */
import { Client } from 'pg';
import { randomUUID } from 'crypto';

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://squadlink:squadlink@localhost:5432/squadlink_test?schema=public';

if (!/test/i.test(DATABASE_URL)) {
  throw new Error(
    `Refusing to run destructive schema tests against a database whose ` +
      `connection string doesn't contain "test": ${DATABASE_URL}`,
  );
}

describe('SquadLink schema constraints (DB-level)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // Cheap full reset — this is a small, fixed set of tables and this
    // suite owns the whole test database.
    await client.query('TRUNCATE "User" CASCADE');
  });

  async function insertUser(
    overrides: Partial<{ email: string; handle: string }> = {},
  ) {
    const id = randomUUID();
    const email = overrides.email ?? `${id}@test.local`;
    const handle = overrides.handle ?? `user-${id.slice(0, 8)}`;
    await client.query(
      `INSERT INTO "User" (id, email, "displayName", handle, "updatedAt")
       VALUES ($1, $2, 'Test User', $3, now())`,
      [id, email, handle],
    );
    return id;
  }

  it('rejects a duplicate email at the database level', async () => {
    await insertUser({ email: 'dup@test.local' });
    await expect(insertUser({ email: 'dup@test.local' })).rejects.toThrow(
      /duplicate key value violates unique constraint "User_email_key"/,
    );
  });

  it('rejects a duplicate handle at the database level', async () => {
    await insertUser({ handle: 'duphandle' });
    await expect(insertUser({ handle: 'duphandle' })).rejects.toThrow(
      /duplicate key value violates unique constraint "User_handle_key"/,
    );
  });

  it('enforces one friendship row per unordered pair', async () => {
    const a = await insertUser();
    const b = await insertUser();
    await client.query(
      `INSERT INTO "Friendship" (id, "userAId", "userBId") VALUES ($1,$2,$3)`,
      [randomUUID(), a, b],
    );
    await expect(
      client.query(
        `INSERT INTO "Friendship" (id, "userAId", "userBId") VALUES ($1,$2,$3)`,
        [randomUUID(), a, b],
      ),
    ).rejects.toThrow(/Friendship_userAId_userBId_key/);
  });

  it('enforces the friend-request lifecycle: only one request per sender/receiver pair', async () => {
    const a = await insertUser();
    const b = await insertUser();
    await client.query(
      `INSERT INTO "FriendRequest" (id, "senderId", "receiverId") VALUES ($1,$2,$3)`,
      [randomUUID(), a, b],
    );
    await expect(
      client.query(
        `INSERT INTO "FriendRequest" (id, "senderId", "receiverId") VALUES ($1,$2,$3)`,
        [randomUUID(), a, b],
      ),
    ).rejects.toThrow(/FriendRequest_senderId_receiverId_key/);
  });

  it('prevents duplicate reactions from the same user with the same emoji', async () => {
    const author = await insertUser();
    const conv = randomUUID();
    await client.query(
      `INSERT INTO "Conversation" (id, type, "updatedAt") VALUES ($1,'DM',now())`,
      [conv],
    );
    const msg = randomUUID();
    await client.query(
      `INSERT INTO "Message" (id, "conversationId", "authorId", content, "createdAt")
       VALUES ($1,$2,$3,'hi',now())`,
      [msg, conv, author],
    );
    await client.query(
      `INSERT INTO "MessageReaction" (id, "messageId", "userId", emoji) VALUES ($1,$2,$3,'🔥')`,
      [randomUUID(), msg, author],
    );
    await expect(
      client.query(
        `INSERT INTO "MessageReaction" (id, "messageId", "userId", emoji) VALUES ($1,$2,$3,'🔥')`,
        [randomUUID(), msg, author],
      ),
    ).rejects.toThrow(/MessageReaction_messageId_userId_emoji_key/);
  });

  it('prevents joining the same conversation twice', async () => {
    const user = await insertUser();
    const conv = randomUUID();
    await client.query(
      `INSERT INTO "Conversation" (id, type, "updatedAt") VALUES ($1,'DM',now())`,
      [conv],
    );
    await client.query(
      `INSERT INTO "ConversationParticipant" (id, "conversationId", "userId") VALUES ($1,$2,$3)`,
      [randomUUID(), conv, user],
    );
    await expect(
      client.query(
        `INSERT INTO "ConversationParticipant" (id, "conversationId", "userId") VALUES ($1,$2,$3)`,
        [randomUUID(), conv, user],
      ),
    ).rejects.toThrow(/ConversationParticipant_conversationId_userId_key/);
  });

  it('prevents duplicate community membership', async () => {
    const owner = await insertUser();
    const community = randomUUID();
    await client.query(
      `INSERT INTO "Community" (id, name, tag, "ownerId", "updatedAt") VALUES ($1,'C','C',$2,now())`,
      [community, owner],
    );
    await client.query(
      `INSERT INTO "CommunityMember" (id, "communityId", "userId") VALUES ($1,$2,$3)`,
      [randomUUID(), community, owner],
    );
    await expect(
      client.query(
        `INSERT INTO "CommunityMember" (id, "communityId", "userId") VALUES ($1,$2,$3)`,
        [randomUUID(), community, owner],
      ),
    ).rejects.toThrow(/CommunityMember_communityId_userId_key/);
  });

  it('prevents duplicate party membership', async () => {
    const owner = await insertUser();
    const party = randomUUID();
    await client.query(
      `INSERT INTO "Party" (id, name, "ownerId", "updatedAt") VALUES ($1,'P',$2,now())`,
      [party, owner],
    );
    await client.query(
      `INSERT INTO "PartyMember" (id, "partyId", "userId", role) VALUES ($1,$2,$3,'LEADER')`,
      [randomUUID(), party, owner],
    );
    await expect(
      client.query(
        `INSERT INTO "PartyMember" (id, "partyId", "userId", role) VALUES ($1,$2,$3,'MEMBER')`,
        [randomUUID(), party, owner],
      ),
    ).rejects.toThrow(/PartyMember_partyId_userId_key/);
  });

  it('cascades conversation deletion to its messages and participants', async () => {
    const user = await insertUser();
    const conv = randomUUID();
    await client.query(
      `INSERT INTO "Conversation" (id, type, "updatedAt") VALUES ($1,'DM',now())`,
      [conv],
    );
    await client.query(
      `INSERT INTO "ConversationParticipant" (id, "conversationId", "userId") VALUES ($1,$2,$3)`,
      [randomUUID(), conv, user],
    );
    await client.query(
      `INSERT INTO "Message" (id, "conversationId", "authorId", content, "createdAt") VALUES ($1,$2,$3,'hi',now())`,
      [randomUUID(), conv, user],
    );

    await client.query(`DELETE FROM "Conversation" WHERE id = $1`, [conv]);

    const messages = await client.query(
      `SELECT * FROM "Message" WHERE "conversationId" = $1`,
      [conv],
    );
    const participants = await client.query(
      `SELECT * FROM "ConversationParticipant" WHERE "conversationId" = $1`,
      [conv],
    );
    expect(messages.rowCount).toBe(0);
    expect(participants.rowCount).toBe(0);
  });

  it('blocks hard-deleting a user who still owns a community or party (RESTRICT)', async () => {
    const owner = await insertUser();
    await client.query(
      `INSERT INTO "Community" (id, name, tag, "ownerId", "updatedAt") VALUES ($1,'C','C',$2,now())`,
      [randomUUID(), owner],
    );

    await expect(
      client.query(`DELETE FROM "User" WHERE id = $1`, [owner]),
    ).rejects.toThrow(
      /violates foreign key constraint "Community_ownerId_fkey"/,
    );
  });

  it('nulls out a reply reference when the replied-to message is deleted, instead of cascading', async () => {
    const author = await insertUser();
    const conv = randomUUID();
    await client.query(
      `INSERT INTO "Conversation" (id, type, "updatedAt") VALUES ($1,'DM',now())`,
      [conv],
    );
    const original = randomUUID();
    await client.query(
      `INSERT INTO "Message" (id, "conversationId", "authorId", content, "createdAt") VALUES ($1,$2,$3,'original',now())`,
      [original, conv, author],
    );
    const reply = randomUUID();
    await client.query(
      `INSERT INTO "Message" (id, "conversationId", "authorId", content, "replyToId", "createdAt") VALUES ($1,$2,$3,'reply',$4,now())`,
      [reply, conv, author, original],
    );

    await client.query(`DELETE FROM "Message" WHERE id = $1`, [original]);

    const result = await client.query(
      `SELECT "replyToId" FROM "Message" WHERE id = $1`,
      [reply],
    );
    expect(result.rows[0].replyToId).toBeNull();
  });

  it('cascades a message deletion to its attachments and reactions', async () => {
    const author = await insertUser();
    const conv = randomUUID();
    await client.query(
      `INSERT INTO "Conversation" (id, type, "updatedAt") VALUES ($1,'DM',now())`,
      [conv],
    );
    const msg = randomUUID();
    await client.query(
      `INSERT INTO "Message" (id, "conversationId", "authorId", content, "createdAt") VALUES ($1,$2,$3,'hi',now())`,
      [msg, conv, author],
    );
    await client.query(
      `INSERT INTO "MessageAttachment" (id, "messageId", type, url, name) VALUES ($1,$2,'IMAGE','http://x','x.png')`,
      [randomUUID(), msg],
    );
    await client.query(
      `INSERT INTO "MessageReaction" (id, "messageId", "userId", emoji) VALUES ($1,$2,$3,'🔥')`,
      [randomUUID(), msg, author],
    );

    await client.query(`DELETE FROM "Message" WHERE id = $1`, [msg]);

    const attachments = await client.query(
      `SELECT * FROM "MessageAttachment" WHERE "messageId" = $1`,
      [msg],
    );
    const reactions = await client.query(
      `SELECT * FROM "MessageReaction" WHERE "messageId" = $1`,
      [msg],
    );
    expect(attachments.rowCount).toBe(0);
    expect(reactions.rowCount).toBe(0);
  });

  it('sets actorId to null (not cascade) when the acting user is deleted', async () => {
    const recipient = await insertUser();
    const actor = await insertUser();
    const notif = randomUUID();
    await client.query(
      `INSERT INTO "Notification" (id, "recipientId", "actorId", type, title, body)
       VALUES ($1,$2,$3,'SYSTEM','t','b')`,
      [notif, recipient, actor],
    );

    await client.query(`DELETE FROM "User" WHERE id = $1`, [actor]);

    const result = await client.query(
      `SELECT "actorId" FROM "Notification" WHERE id = $1`,
      [notif],
    );
    expect(result.rows[0].actorId).toBeNull();
    const stillExists = await client.query(
      `SELECT 1 FROM "Notification" WHERE id = $1`,
      [notif],
    );
    expect(stillExists.rowCount).toBe(1);
  });

  it('cascades attachment relations when a party is deleted (members, invites)', async () => {
    const owner = await insertUser();
    const invitee = await insertUser();
    const party = randomUUID();
    await client.query(
      `INSERT INTO "Party" (id, name, "ownerId", "updatedAt") VALUES ($1,'P',$2,now())`,
      [party, owner],
    );
    await client.query(
      `INSERT INTO "PartyMember" (id, "partyId", "userId", role) VALUES ($1,$2,$3,'LEADER')`,
      [randomUUID(), party, owner],
    );
    await client.query(
      `INSERT INTO "PartyInvite" (id, "partyId", "inviterId", "inviteeId") VALUES ($1,$2,$3,$4)`,
      [randomUUID(), party, owner, invitee],
    );

    await client.query(`DELETE FROM "Party" WHERE id = $1`, [party]);

    const members = await client.query(
      `SELECT * FROM "PartyMember" WHERE "partyId" = $1`,
      [party],
    );
    const invites = await client.query(
      `SELECT * FROM "PartyInvite" WHERE "partyId" = $1`,
      [party],
    );
    expect(members.rowCount).toBe(0);
    expect(invites.rowCount).toBe(0);
  });
});
