import { Test } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { FriendsRepository } from './friends.repository';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ConflictException,
  ForbiddenActionException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';

describe('FriendsService', () => {
  let service: FriendsService;
  let friendsRepository: jest.Mocked<FriendsRepository>;
  let usersService: jest.Mocked<UsersService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const friendsRepoMock: Partial<jest.Mocked<FriendsRepository>> = {
      isBlockedEitherWay: jest.fn().mockResolvedValue(false),
      findFriendship: jest.fn().mockResolvedValue(null),
      findRequestBetween: jest.fn().mockResolvedValue(null),
      createRequest: jest.fn(),
      findRequestById: jest.fn(),
      updateRequestStatus: jest.fn(),
      createFriendship: jest.fn(),
      acceptRequestAtomic: jest.fn(),
    };
    const usersServiceMock: Partial<jest.Mocked<UsersService>> = {
      findByHandle: jest.fn(),
    };
    const notificationsServiceMock: Partial<jest.Mocked<NotificationsService>> =
      {
        create: jest.fn(),
      };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: FriendsRepository, useValue: friendsRepoMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    service = moduleRef.get(FriendsService);
    friendsRepository = moduleRef.get(FriendsRepository);
    usersService = moduleRef.get(UsersService);
    notificationsService = moduleRef.get(NotificationsService);
  });

  describe('sendRequest', () => {
    it('throws if the target handle does not exist', async () => {
      usersService.findByHandle.mockResolvedValue(null);

      await expect(service.sendRequest('u1', 'ghost')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('rejects sending a request to yourself', async () => {
      usersService.findByHandle.mockResolvedValue({ id: 'u1' });

      await expect(service.sendRequest('u1', 'myself')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects when either user has blocked the other', async () => {
      usersService.findByHandle.mockResolvedValue({ id: 'u2' });
      friendsRepository.isBlockedEitherWay.mockResolvedValue(true);

      await expect(
        service.sendRequest('u1', 'blocked-user'),
      ).rejects.toBeInstanceOf(ForbiddenActionException);
    });

    it('rejects when already friends', async () => {
      usersService.findByHandle.mockResolvedValue({ id: 'u2' });
      friendsRepository.findFriendship.mockResolvedValue({
        id: 'friendship-1',
      });

      await expect(
        service.sendRequest('u1', 'existing-friend'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a request and notifies the recipient on success', async () => {
      usersService.findByHandle.mockResolvedValue({ id: 'u2' });
      friendsRepository.createRequest.mockResolvedValue({
        id: 'req-1',
        senderId: 'u1',
        receiverId: 'u2',
        sender: { displayName: 'Roshan' },
        receiver: { displayName: 'Ava' },
      });

      const result = await service.sendRequest('u1', 'ava');

      expect(result).toMatchObject({ id: 'req-1' });
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'u2',
          actorId: 'u1',
          type: 'FRIEND_REQUEST',
        }),
      );
    });
  });

  describe('acceptRequest', () => {
    it('throws when the request does not belong to the current user', async () => {
      friendsRepository.findRequestById.mockResolvedValue({
        id: 'req-1',
        receiverId: 'someone-else',
        status: 'PENDING',
      });

      await expect(service.acceptRequest('u1', 'req-1')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });

    it('throws when the request was already responded to', async () => {
      friendsRepository.findRequestById.mockResolvedValue({
        id: 'req-1',
        receiverId: 'u1',
        status: 'ACCEPTED',
      });

      await expect(service.acceptRequest('u1', 'req-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
