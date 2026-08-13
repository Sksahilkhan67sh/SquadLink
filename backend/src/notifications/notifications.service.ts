import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import {
  ForbiddenActionException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination.dto';
import { NotificationsRepository } from './notifications.repository';

export const NOTIFICATION_CREATED_EVENT = 'notification.created';

export interface NotificationCreatedPayload {
  recipientId: string;
  notification: unknown;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(params: {
    recipientId: string;
    actorId?: string;
    type: NotificationType;
    title: string;
    body: string;
  }) {
    // Don't notify yourself about your own action.
    if (params.actorId === params.recipientId) return null;

    const notification = await this.notificationsRepository.create(params);

    this.eventEmitter.emit(NOTIFICATION_CREATED_EVENT, {
      recipientId: params.recipientId,
      notification,
    } satisfies NotificationCreatedPayload);

    return notification;
  }

  async list(userId: string, page: number, limit: number) {
    const { items, total } = await this.notificationsRepository.list(
      userId,
      page,
      limit,
    );
    return paginate(items, total, page, limit);
  }

  countUnread(userId: string) {
    return this.notificationsRepository.countUnread(userId);
  }

  async markRead(userId: string, id: string) {
    const notification = await this.notificationsRepository.findById(id);
    if (!notification || notification.recipientId !== userId) {
      throw new ResourceNotFoundException('Notification', id);
    }
    return this.notificationsRepository.markRead(id);
  }

  markAllRead(userId: string) {
    return this.notificationsRepository.markAllRead(userId);
  }

  async remove(userId: string, id: string) {
    const notification = await this.notificationsRepository.findById(id);
    if (!notification || notification.recipientId !== userId) {
      throw new ResourceNotFoundException('Notification', id);
    }
    if (notification.recipientId !== userId)
      throw new ForbiddenActionException();
    await this.notificationsRepository.remove(id);
  }
}
