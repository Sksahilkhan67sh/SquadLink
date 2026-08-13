import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { LiveKitService } from '../shared/livekit/livekit.service';
import {
  ConflictException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;
  let liveKit: jest.Mocked<LiveKitService>;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<UsersRepository>> = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByHandle: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updatePresence: jest.fn(),
      getPreferences: jest.fn(),
      updatePreferences: jest.fn(),
      search: jest.fn(),
      deleteAccount: jest.fn(),
    };
    const liveKitMock: Partial<jest.Mocked<LiveKitService>> = {
      closeRoom: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repoMock },
        { provide: LiveKitService, useValue: liveKitMock },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    repository = moduleRef.get(UsersRepository);
    liveKit = moduleRef.get(LiveKitService);
  });

  describe('findByIdOrThrow', () => {
    it('returns the user when found', async () => {
      const user = { id: 'u1', displayName: 'Ava' };
      repository.findById.mockResolvedValue(user);

      await expect(service.findByIdOrThrow('u1')).resolves.toEqual(user);
    });

    it('throws ResourceNotFoundException when the user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findByIdOrThrow('missing')).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe('createLocalUser', () => {
    it('rejects when the email is already taken', async () => {
      repository.findByEmail.mockResolvedValue({ id: 'existing' });
      repository.findByHandle.mockResolvedValue(null);

      await expect(
        service.createLocalUser({
          email: 'taken@example.com',
          handle: 'newhandle',
          displayName: 'New User',
          passwordHash: 'hash',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects when the handle is already taken', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.findByHandle.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createLocalUser({
          email: 'new@example.com',
          handle: 'taken',
          displayName: 'New User',
          passwordHash: 'hash',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates the user when email and handle are both free', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.findByHandle.mockResolvedValue(null);
      repository.create.mockResolvedValue({ id: 'new-id' });

      const result = await service.createLocalUser({
        email: 'new@example.com',
        handle: 'freehandle',
        displayName: 'New User',
        passwordHash: 'hash',
      });

      expect(result).toEqual({ id: 'new-id' });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          handle: 'freehandle',
        }),
      );
    });
  });

  describe('updateProfile', () => {
    it('rejects a handle change to one already owned by someone else', async () => {
      repository.findByHandle.mockResolvedValue({
        id: 'someone-else',
      });

      await expect(
        service.updateProfile('u1', { handle: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('allows keeping your own current handle', async () => {
      repository.findByHandle.mockResolvedValue({ id: 'u1' });
      repository.update.mockResolvedValue({ id: 'u1', handle: 'me' });

      await expect(
        service.updateProfile('u1', { handle: 'me' }),
      ).resolves.toEqual({ id: 'u1', handle: 'me' });
    });
  });

  describe('search', () => {
    it('returns an empty array for a blank query without hitting the repository', async () => {
      const result = await service.search('   ', 'u1');
      expect(result).toEqual([]);
      expect(repository.search).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('rejects when the account is already deleted', async () => {
      repository.findById.mockResolvedValue({
        id: 'u1',
        deletedAt: new Date(),
      });

      await expect(service.deleteAccount('u1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.deleteAccount).not.toHaveBeenCalled();
    });

    it('anonymizes the account and closes any orphaned voice rooms', async () => {
      repository.findById.mockResolvedValue({
        id: 'u1',
        deletedAt: null,
      });
      repository.deleteAccount.mockResolvedValue({
        closedVoiceRooms: ['party-abc'],
      });

      await service.deleteAccount('u1');

      expect(repository.deleteAccount).toHaveBeenCalledWith('u1');
      expect(liveKit.closeRoom).toHaveBeenCalledWith('party-abc');
    });
  });
});
