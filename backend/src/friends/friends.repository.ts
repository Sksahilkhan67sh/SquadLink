import { Injectable } from '@nestjs/common';
import { FriendRequestStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

@Injectable()
export class FriendsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRequestBetween(senderId: string, receiverId: string) {
    return this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
        status: FriendRequestStatus.PENDING,
      },
    });
  }

  createRequest(senderId: string, receiverId: string) {
    return this.prisma.friendRequest.create({
      data: { senderId, receiverId },
      include: { sender: true, receiver: true },
    });
  }

  findRequestById(id: string) {
    return this.prisma.friendRequest.findUnique({
      where: { id },
      include: { sender: true, receiver: true },
    });
  }

  updateRequestStatus(id: string, status: FriendRequestStatus) {
    return this.prisma.friendRequest.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    });
  }

  listIncoming(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: { receiverId: userId, status: FriendRequestStatus.PENDING },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listOutgoing(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: { senderId: userId, status: FriendRequestStatus.PENDING },
      include: { receiver: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createFriendship(userIdA: string, userIdB: string) {
    const [userAId, userBId] = orderedPair(userIdA, userIdB);
    return this.prisma.friendship.create({ data: { userAId, userBId } });
  }

  /**
   * Atomically accepts a pending request: the status flip and the
   * friendship row are created in one transaction, and the status update
   * is conditioned on still being PENDING so two concurrent accepts can't
   * both "win" (the loser's updateMany matches zero rows and the call
   * returns null — see FriendsService.acceptRequest).
   */
  async acceptRequestAtomic(
    requestId: string,
    senderId: string,
    receiverId: string,
  ) {
    const [userAId, userBId] = orderedPair(senderId, receiverId);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.friendRequest.updateMany({
        where: { id: requestId, status: FriendRequestStatus.PENDING },
        data: { status: FriendRequestStatus.ACCEPTED, respondedAt: new Date() },
      });
      if (count === 0) return null;
      return tx.friendship.create({ data: { userAId, userBId } });
    });
  }

  findFriendship(userIdA: string, userIdB: string) {
    const [userAId, userBId] = orderedPair(userIdA, userIdB);
    return this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
  }

  listFriendships(userId: string) {
    return this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: { userA: true, userB: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  removeFriendship(userIdA: string, userIdB: string) {
    const [userAId, userBId] = orderedPair(userIdA, userIdB);
    return this.prisma.friendship.delete({
      where: { userAId_userBId: { userAId, userBId } },
    });
  }

  setPinned(userId: string, otherUserId: string, pinned: boolean) {
    const [userAId, userBId] = orderedPair(userId, otherUserId);
    const isRequesterA = userId === userAId;
    return this.prisma.friendship.update({
      where: { userAId_userBId: { userAId, userBId } },
      data: isRequesterA ? { pinnedByA: pinned } : { pinnedByB: pinned },
    });
  }

  createBlock(blockerId: string, blockedId: string) {
    return this.prisma.block.create({ data: { blockerId, blockedId } });
  }

  removeBlock(blockerId: string, blockedId: string) {
    return this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
  }

  findBlock(blockerId: string, blockedId: string) {
    return this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
  }

  listBlocked(userId: string) {
    return this.prisma.block.findMany({
      where: { blockerId: userId },
      include: { blocked: true },
    });
  }

  async isBlockedEitherWay(userIdA: string, userIdB: string): Promise<boolean> {
    const count = await this.prisma.block.count({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
    });
    return count > 0;
  }

  async countMutualFriends(userIdA: string, userIdB: string): Promise<number> {
    const [friendsA, friendsB] = await Promise.all([
      this.listFriendIds(userIdA),
      this.listFriendIds(userIdB),
    ]);
    const setB = new Set(friendsB);
    return friendsA.filter((id) => setB.has(id)).length;
  }

  private async listFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    return friendships.map((f) =>
      f.userAId === userId ? f.userBId : f.userAId,
    );
  }
}
