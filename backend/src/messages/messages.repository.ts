import { Injectable } from '@nestjs/common';
import { ConversationType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const messageInclude = {
  author: true,
  attachments: true,
  reactions: { include: { user: true } },
  replyTo: { include: { author: true } },
} satisfies Prisma.MessageInclude;

const notDeleted = { deletedAt: null } satisfies Prisma.MessageWhereInput;

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDmBetween(userIdA: string, userIdB: string) {
    return this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DM,
        AND: [
          { participants: { some: { userId: userIdA } } },
          { participants: { some: { userId: userIdB } } },
        ],
      },
      include: { participants: { include: { user: true } } },
    });
  }

  createDm(userIdA: string, userIdB: string) {
    return this.prisma.conversation.create({
      data: {
        type: ConversationType.DM,
        participants: { create: [{ userId: userIdA }, { userId: userIdB }] },
      },
      include: { participants: { include: { user: true } } },
    });
  }

  createGroup(name: string, memberIds: string[]) {
    return this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        name,
        participants: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: { participants: { include: { user: true } } },
    });
  }

  findConversationForUser(conversationId: string, userId: string) {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId } } },
      include: { participants: { include: { user: true } } },
    });
  }

  async listConversationsForUser(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: true } },
        messages: {
          where: notDeleted,
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageInclude,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (conversations.length === 0) return [];

    // Single aggregate query instead of one COUNT per conversation
    // (previously N+1 — see docs/database/query-guidelines.md).
    const conversationIds = conversations.map((c) => c.id);
    const unreadRows = await this.prisma.$queryRaw<
      { conversationId: string; unread: bigint }[]
    >`
      SELECT cp."conversationId" AS "conversationId", COUNT(m.id)::bigint AS unread
      FROM "ConversationParticipant" cp
      JOIN "Message" m
        ON m."conversationId" = cp."conversationId"
        AND m."authorId" != ${userId}
        AND m."deletedAt" IS NULL
        AND m."createdAt" > COALESCE(cp."lastReadAt", to_timestamp(0))
      WHERE cp."userId" = ${userId}
        AND cp."conversationId" = ANY(${conversationIds}::text[])
      GROUP BY cp."conversationId"
    `;
    const unreadMap = new Map(
      unreadRows.map((r) => [r.conversationId, Number(r.unread)]),
    );

    return conversations.map((c) => ({
      ...c,
      unread: unreadMap.get(c.id) ?? 0,
    }));
  }

  async listMessages(conversationId: string, page: number, limit: number) {
    // Offset pagination, capped at 100/page by PaginationQueryDto. This
    // keeps the existing REST contract (page/limit) that the frontend
    // relies on. It's bounded and indexed (conversationId+createdAt), so
    // it's acceptable at current scale; see docs/database/query-guidelines.md
    // for the documented, non-breaking migration path to keyset (before/
    // after messageId) pagination for very deep history at large scale.
    const where = { conversationId, ...notDeleted };
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        include: messageInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.message.count({ where }),
    ]);
    return { items: items.reverse(), total };
  }

  async createMessage(params: {
    conversationId: string;
    authorId: string;
    content: string;
    replyToId?: string;
    attachments?: {
      type: 'IMAGE' | 'FILE';
      url: string;
      name: string;
      size?: number;
    }[];
  }) {
    const { attachments, ...data } = params;
    const message = await this.prisma.message.create({
      data: {
        ...data,
        attachments: attachments?.length ? { create: attachments } : undefined,
      },
      include: messageInclude,
    });
    await this.prisma.conversation.update({
      where: { id: params.conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  }

  findMessageById(id: string) {
    return this.prisma.message.findUnique({
      where: { id },
      include: messageInclude,
    });
  }

  updateMessageContent(id: string, content: string) {
    return this.prisma.message.update({
      where: { id },
      data: { content, editedAt: new Date() },
      include: messageInclude,
    });
  }

  setPinned(id: string, pinned: boolean) {
    return this.prisma.message.update({
      where: { id },
      data: { pinned },
      include: messageInclude,
    });
  }

  deleteMessage(id: string) {
    // Soft delete — keeps the row so reply threads and moderation/audit
    // history remain intact instead of orphaning replies or losing the
    // record entirely (see Message.deletedAt in schema.prisma).
    return this.prisma.message.update({
      where: { id },
      data: { content: '', deletedAt: new Date(), pinned: false },
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    await this.prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });
    return this.findMessageById(messageId);
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    await this.prisma.messageReaction.deleteMany({
      where: { messageId, userId, emoji },
    });
    return this.findMessageById(messageId);
  }

  markRead(conversationId: string, userId: string) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  setMuted(conversationId: string, userId: string, muted: boolean) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { muted },
    });
  }

  searchMessages(userId: string, query: string, limit = 20) {
    return this.prisma.message.findMany({
      where: {
        ...notDeleted,
        content: { contains: query, mode: 'insensitive' },
        conversation: { participants: { some: { userId } } },
      },
      include: { ...messageInclude, conversation: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  addAttachment(
    messageId: string,
    data: { type: 'IMAGE' | 'FILE'; url: string; name: string; size?: number },
  ) {
    return this.prisma.messageAttachment.create({
      data: { messageId, ...data },
    });
  }
}
