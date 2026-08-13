import { Injectable } from '@nestjs/common';
import { PresenceStatus, User } from '@prisma/client';
import {
  ConflictException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';
import { UsersRepository } from './users.repository';
import { LiveKitService } from '../shared/livekit/livekit.service';
import {
  UpdatePreferencesDto,
  UpdatePresenceDto,
  UpdateProfileDto,
} from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly liveKitService: LiveKitService,
  ) {}

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new ResourceNotFoundException('User', id);
    return user;
  }

  findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  findByHandle(handle: string) {
    return this.usersRepository.findByHandle(handle);
  }

  findManyByIds(ids: string[]) {
    return this.usersRepository.findManyByIds(ids);
  }

  async isHandleTaken(handle: string): Promise<boolean> {
    const existing = await this.usersRepository.findByHandle(handle);
    return Boolean(existing);
  }

  async createLocalUser(params: {
    email: string;
    handle: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User> {
    const [emailTaken, handleTaken] = await Promise.all([
      this.usersRepository.findByEmail(params.email),
      this.usersRepository.findByHandle(params.handle),
    ]);
    if (emailTaken)
      throw new ConflictException('An account with this email already exists');
    if (handleTaken)
      throw new ConflictException('This handle is already taken');

    return this.usersRepository.create(params);
  }

  async createOAuthUser(params: {
    email: string;
    handle: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<User> {
    let handle = params.handle;
    let suffix = 0;
    // Guarantee handle uniqueness for OAuth sign-ups without prompting —
    // falls back to `handle2`, `handle3`, ... on collision.
    while (await this.usersRepository.findByHandle(handle)) {
      suffix += 1;
      handle = `${params.handle}${suffix + 1}`;
    }

    return this.usersRepository.create({
      email: params.email,
      handle,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl,
      emailVerifiedAt: new Date(),
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    if (dto.handle) {
      const existing = await this.usersRepository.findByHandle(dto.handle);
      if (existing && existing.id !== userId) {
        throw new ConflictException('This handle is already taken');
      }
    }
    return this.usersRepository.update(userId, dto);
  }

  async updatePresence(userId: string, dto: UpdatePresenceDto): Promise<User> {
    const user = await this.findByIdOrThrow(userId);
    return this.usersRepository.updatePresence(
      userId,
      dto.status ?? user.status,
      dto.statusText !== undefined ? dto.statusText : user.statusText,
      dto.currentGame !== undefined ? dto.currentGame : user.currentGame,
    );
  }

  async setOffline(userId: string): Promise<void> {
    await this.usersRepository.updatePresence(
      userId,
      PresenceStatus.OFFLINE,
      null,
      null,
    );
  }

  async getPreferences(userId: string) {
    const prefs = await this.usersRepository.getPreferences(userId);
    if (!prefs)
      throw new ResourceNotFoundException('Preferences for user', userId);
    return prefs;
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.getPreferences(userId);
    return this.usersRepository.updatePreferences(userId, dto);
  }

  async search(query: string, requesterId: string) {
    if (!query.trim()) return [];
    return this.usersRepository.search(query.trim(), requesterId);
  }

  /**
   * Soft-deletes the account (see UsersRepository.deleteAccount). Any
   * voice rooms belonging to a party the user solely occupied are closed
   * out-of-band after the DB transaction commits.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    if (user.deletedAt) {
      throw new ConflictException('This account has already been deleted');
    }
    const { closedVoiceRooms } =
      await this.usersRepository.deleteAccount(userId);
    await Promise.all(
      closedVoiceRooms.map((livekitName) =>
        this.liveKitService.closeRoom(livekitName).catch(() => undefined),
      ),
    );
  }
}
