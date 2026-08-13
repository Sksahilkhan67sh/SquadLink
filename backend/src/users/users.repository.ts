import { Injectable } from '@nestjs/common';
import { Prisma, PresenceStatus, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByIdWithPreferences(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { preferences: true },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  findByHandle(handle: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { handle } });
  }

  findManyByIds(ids: string[]): Promise<User[]> {
    return this.prisma.user.findMany({ where: { id: { in: ids } } });
  }

  create(data: {
    email: string;
    handle: string;
    displayName: string;
    passwordHash?: string;
    emailVerifiedAt?: Date;
    avatarUrl?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        handle: data.handle,
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        emailVerifiedAt: data.emailVerifiedAt,
        avatarUrl: data.avatarUrl,
        preferences: { create: {} },
      },
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  markEmailVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  updatePresence(
    id: string,
    status: PresenceStatus,
    statusText?: string | null,
    currentGame?: string | null,
  ) {
    return this.prisma.user.update({
      where: { id },
      data: { status, statusText, currentGame },
    });
  }

  search(query: string, excludeUserId: string, limit = 20): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        deletedAt: null,
        OR: [
          { displayName: { contains: query, mode: 'insensitive' } },
          { handle: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { displayName: 'asc' },
    });
  }

  getPreferences(userId: string) {
    return this.prisma.userPreferences.findUnique({ where: { userId } });
  }

  updatePreferences(userId: string, data: Prisma.UserPreferencesUpdateInput) {
    return this.prisma.userPreferences.update({ where: { userId }, data });
  }

  /**
   * Soft-deletes an account: PII is scrubbed and `deletedAt` is set, but
   * the row is kept so message authorship and other users' history are
   * never destroyed as a side effect. Ownership of communities/parties is
   * transferred to another active member where one exists; a community or
   * party the user solely occupied is deleted outright (nothing else
   * depends on it). Returns the livekitNames of any voice rooms whose
   * owning party was deleted, so the caller can close them out-of-band
   * (external LiveKit calls don't belong inside a DB transaction).
   */
  async deleteAccount(userId: string): Promise<{ closedVoiceRooms: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const closedVoiceRooms: string[] = [];

      const ownedCommunities = await tx.community.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      for (const { id: communityId } of ownedCommunities) {
        const nextOwner = await tx.communityMember.findFirst({
          where: {
            communityId,
            userId: { not: userId },
            status: 'ACTIVE',
          },
          orderBy: { joinedAt: 'asc' },
        });
        if (nextOwner) {
          await tx.community.update({
            where: { id: communityId },
            data: { owner: { connect: { id: nextOwner.userId } } },
          });
        } else {
          await tx.community.delete({ where: { id: communityId } });
        }
      }

      const ownedParties = await tx.party.findMany({
        where: { ownerId: userId },
        include: { voiceRoom: true },
      });
      for (const party of ownedParties) {
        const nextOwner = await tx.partyMember.findFirst({
          where: { partyId: party.id, userId: { not: userId } },
          orderBy: { joinedAt: 'asc' },
        });
        if (nextOwner) {
          await tx.partyMember.update({
            where: { partyId_userId: { partyId: party.id, userId: userId } },
            data: { role: 'MEMBER' },
          });
          await tx.partyMember.update({
            where: {
              partyId_userId: { partyId: party.id, userId: nextOwner.userId },
            },
            data: { role: 'LEADER' },
          });
          await tx.party.update({
            where: { id: party.id },
            data: { owner: { connect: { id: nextOwner.userId } } },
          });
        } else {
          await tx.party.delete({ where: { id: party.id } });
          if (party.voiceRoom)
            closedVoiceRooms.push(party.voiceRoom.livekitName);
        }
      }

      const tombstone = `deleted-${userId}`;
      await tx.user.update({
        where: { id: userId },
        data: {
          displayName: 'Deleted User',
          handle: tombstone,
          email: `${tombstone}@squadlink.invalid`,
          passwordHash: null,
          avatarUrl: null,
          bio: null,
          statusText: null,
          currentGame: null,
          status: 'OFFLINE',
          deletedAt: new Date(),
        },
      });

      return { closedVoiceRooms };
    });
  }
}
