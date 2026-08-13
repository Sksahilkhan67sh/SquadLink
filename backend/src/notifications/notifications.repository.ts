import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    recipientId: string;
    actorId?: string;
    type: NotificationType;
    title: string;
    body: string;
  }) {
    return this.prisma.notification.create({
      data,
      include: { actor: true },
    });
  }

  async list(userId: string, page: number, limit: number) {
    const where: Prisma.NotificationWhereInput = { recipientId: userId };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({
      where: { recipientId: userId, read: false },
    });
  }

  findById(id: string) {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true },
    });
  }

  remove(id: string) {
    return this.prisma.notification.delete({ where: { id } });
  }
}
