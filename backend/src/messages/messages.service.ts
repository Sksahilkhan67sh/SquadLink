import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ForbiddenActionException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination.dto';
import { MessagesRepository } from './messages.repository';

export const MESSAGE_CREATED_EVENT = 'message.created';
export const MESSAGE_UPDATED_EVENT = 'message.updated';

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getOrCreateDm(userId: string, otherUserId: string) {
    if (userId === otherUserId)
      throw new ForbiddenActionException(
        'Cannot start a conversation with yourself',
      );
    const existing = await this.messagesRepository.findDmBetween(
      userId,
      otherUserId,
    );
    if (existing) return existing;
    return this.messagesRepository.createDm(userId, otherUserId);
  }

  createGroup(userId: string, name: string, memberIds: string[]) {
    const uniqueMembers = Array.from(new Set([userId, ...memberIds]));
    return this.messagesRepository.createGroup(name, uniqueMembers);
  }

  listConversations(userId: string) {
    return this.messagesRepository.listConversationsForUser(userId);
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.messagesRepository.findConversationForUser(
      conversationId,
      userId,
    );
    if (!conversation)
      throw new ResourceNotFoundException('Conversation', conversationId);
    return conversation;
  }

  async listMessages(
    userId: string,
    conversationId: string,
    page: number,
    limit: number,
  ) {
    await this.assertParticipant(conversationId, userId);
    const { items, total } = await this.messagesRepository.listMessages(
      conversationId,
      page,
      limit,
    );
    return paginate(items, total, page, limit);
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    content: string,
    replyToId?: string,
    attachments?: {
      type: 'IMAGE' | 'FILE';
      url: string;
      name: string;
      size?: number;
    }[],
  ) {
    const conversation = await this.assertParticipant(conversationId, userId);
    const message = await this.messagesRepository.createMessage({
      conversationId,
      authorId: userId,
      content,
      replyToId,
      attachments,
    });

    const recipientIds = conversation.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);

    this.eventEmitter.emit(MESSAGE_CREATED_EVENT, {
      conversationId,
      message,
      recipientIds,
    });
    return message;
  }

  private async assertAuthor(messageId: string, userId: string) {
    const message = await this.messagesRepository.findMessageById(messageId);
    if (!message || message.deletedAt)
      throw new ResourceNotFoundException('Message', messageId);
    if (message.authorId !== userId)
      throw new ForbiddenActionException('You can only edit your own messages');
    return message;
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const message = await this.assertAuthor(messageId, userId);
    const updated = await this.messagesRepository.updateMessageContent(
      messageId,
      content,
    );
    this.eventEmitter.emit(MESSAGE_UPDATED_EVENT, {
      conversationId: message.conversationId,
      message: updated,
    });
    return updated;
  }

  async deleteMessage(userId: string, messageId: string) {
    await this.assertAuthor(messageId, userId);
    await this.messagesRepository.deleteMessage(messageId);
  }

  async pinMessage(
    userId: string,
    conversationId: string,
    messageId: string,
    pinned: boolean,
  ) {
    await this.assertParticipant(conversationId, userId);
    // messageId must belong to conversationId — otherwise a participant of
    // one conversation could pass their own conversationId (to pass the
    // check above) alongside a messageId from a conversation they aren't
    // in, and pin/unpin a message there.
    const message = await this.messagesRepository.findMessageById(messageId);
    if (
      !message ||
      message.deletedAt ||
      message.conversationId !== conversationId
    ) {
      throw new ResourceNotFoundException('Message', messageId);
    }
    return this.messagesRepository.setPinned(messageId, pinned);
  }

  async react(userId: string, messageId: string, emoji: string) {
    const message = await this.messagesRepository.findMessageById(messageId);
    if (!message || message.deletedAt)
      throw new ResourceNotFoundException('Message', messageId);
    await this.assertParticipant(message.conversationId, userId);
    const updated = await this.messagesRepository.addReaction(
      messageId,
      userId,
      emoji,
    );
    this.eventEmitter.emit(MESSAGE_UPDATED_EVENT, {
      conversationId: message.conversationId,
      message: updated,
    });
    return updated;
  }

  async unreact(userId: string, messageId: string, emoji: string) {
    const message = await this.messagesRepository.findMessageById(messageId);
    if (!message || message.deletedAt)
      throw new ResourceNotFoundException('Message', messageId);
    await this.assertParticipant(message.conversationId, userId);
    const updated = await this.messagesRepository.removeReaction(
      messageId,
      userId,
      emoji,
    );
    this.eventEmitter.emit(MESSAGE_UPDATED_EVENT, {
      conversationId: message.conversationId,
      message: updated,
    });
    return updated;
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    return this.messagesRepository.markRead(conversationId, userId);
  }

  async setMuted(userId: string, conversationId: string, muted: boolean) {
    await this.assertParticipant(conversationId, userId);
    return this.messagesRepository.setMuted(conversationId, userId, muted);
  }

  search(userId: string, query: string) {
    if (!query.trim()) return [];
    return this.messagesRepository.searchMessages(userId, query.trim());
  }
}
