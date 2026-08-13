import { Injectable } from '@nestjs/common';
import { FriendRequestStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ConflictException,
  ForbiddenActionException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';
import { FriendsRepository } from './friends.repository';

@Injectable()
export class FriendsService {
  constructor(
    private readonly friendsRepository: FriendsRepository,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendRequest(senderId: string, handle: string) {
    const receiver = await this.usersService.findByHandle(handle);
    if (!receiver) throw new ResourceNotFoundException('User', handle);
    if (receiver.id === senderId)
      throw new ConflictException('You cannot add yourself as a friend');

    const blocked = await this.friendsRepository.isBlockedEitherWay(
      senderId,
      receiver.id,
    );
    if (blocked)
      throw new ForbiddenActionException(
        'You cannot send a request to this user',
      );

    const existingFriendship = await this.friendsRepository.findFriendship(
      senderId,
      receiver.id,
    );
    if (existingFriendship)
      throw new ConflictException('You are already friends with this user');

    const existingRequest = await this.friendsRepository.findRequestBetween(
      senderId,
      receiver.id,
    );
    if (existingRequest)
      throw new ConflictException(
        'A friend request is already pending between you two',
      );

    const request = await this.friendsRepository.createRequest(
      senderId,
      receiver.id,
    );

    await this.notificationsService.create({
      recipientId: receiver.id,
      actorId: senderId,
      type: 'FRIEND_REQUEST',
      title: 'Friend request',
      body: `${request.sender.displayName} sent you a friend request.`,
    });

    return request;
  }

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.friendsRepository.findRequestById(requestId);
    if (!request || request.receiverId !== userId) {
      throw new ResourceNotFoundException('Friend request', requestId);
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw new ConflictException('This request has already been responded to');
    }

    const friendship = await this.friendsRepository.acceptRequestAtomic(
      requestId,
      request.senderId,
      request.receiverId,
    );
    if (!friendship) {
      // Lost the race to a concurrent accept/decline/cancel on the same request.
      throw new ConflictException('This request has already been responded to');
    }

    await this.notificationsService.create({
      recipientId: request.senderId,
      actorId: userId,
      type: 'SYSTEM',
      title: 'Friend request accepted',
      body: `${request.receiver.displayName} accepted your friend request.`,
    });

    return friendship;
  }

  async declineRequest(userId: string, requestId: string) {
    const request = await this.friendsRepository.findRequestById(requestId);
    if (!request || request.receiverId !== userId) {
      throw new ResourceNotFoundException('Friend request', requestId);
    }
    return this.friendsRepository.updateRequestStatus(
      requestId,
      FriendRequestStatus.DECLINED,
    );
  }

  async cancelRequest(userId: string, requestId: string) {
    const request = await this.friendsRepository.findRequestById(requestId);
    if (!request || request.senderId !== userId) {
      throw new ResourceNotFoundException('Friend request', requestId);
    }
    return this.friendsRepository.updateRequestStatus(
      requestId,
      FriendRequestStatus.CANCELLED,
    );
  }

  listIncoming(userId: string) {
    return this.friendsRepository.listIncoming(userId);
  }

  listOutgoing(userId: string) {
    return this.friendsRepository.listOutgoing(userId);
  }

  async listFriends(userId: string) {
    const friendships = await this.friendsRepository.listFriendships(userId);
    return friendships.map((f) => {
      const isUserA = f.userAId === userId;
      const friend = isUserA ? f.userB : f.userA;
      const pinned = isUserA ? f.pinnedByA : f.pinnedByB;
      return { friend, pinned, since: f.createdAt };
    });
  }

  async removeFriend(userId: string, friendUserId: string) {
    const friendship = await this.friendsRepository.findFriendship(
      userId,
      friendUserId,
    );
    if (!friendship) throw new ResourceNotFoundException('Friendship');
    await this.friendsRepository.removeFriendship(userId, friendUserId);
  }

  async setPinned(userId: string, friendUserId: string, pinned: boolean) {
    const friendship = await this.friendsRepository.findFriendship(
      userId,
      friendUserId,
    );
    if (!friendship) throw new ResourceNotFoundException('Friendship');
    return this.friendsRepository.setPinned(userId, friendUserId, pinned);
  }

  async blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId)
      throw new ConflictException('You cannot block yourself');
    const existing = await this.friendsRepository.findBlock(
      userId,
      targetUserId,
    );
    if (existing) throw new ConflictException('User is already blocked');

    const friendship = await this.friendsRepository.findFriendship(
      userId,
      targetUserId,
    );
    if (friendship)
      await this.friendsRepository.removeFriendship(userId, targetUserId);

    return this.friendsRepository.createBlock(userId, targetUserId);
  }

  async unblockUser(userId: string, targetUserId: string) {
    await this.friendsRepository.removeBlock(userId, targetUserId);
  }

  listBlocked(userId: string) {
    return this.friendsRepository.listBlocked(userId);
  }

  async mutualFriends(userId: string, otherUserId: string): Promise<number> {
    return this.friendsRepository.countMutualFriends(userId, otherUserId);
  }
}
