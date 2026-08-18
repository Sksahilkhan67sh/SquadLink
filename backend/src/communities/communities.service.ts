import { Injectable } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConflictException,
  ForbiddenActionException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination.dto';
import { CommunitiesRepository } from './communities.repository';

const MANAGE_PERMISSIONS = ['ADMINISTRATOR', 'MANAGE_CHANNELS', 'MANAGE_ROLES'];

export const CHANNEL_MESSAGE_CREATED_EVENT = 'channel.message.created';

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly communitiesRepository: CommunitiesRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  create(ownerId: string, name: string, tag: string) {
    return this.communitiesRepository.create(ownerId, name, tag.toUpperCase());
  }

  listForUser(userId: string) {
    return this.communitiesRepository.listForUser(userId);
  }

  browse(query?: string, limit = 20) {
    return this.communitiesRepository.listPublic(query, limit);
  }

  async getByIdForMember(userId: string, communityId: string) {
    const community = await this.communitiesRepository.findById(communityId);
    if (!community)
      throw new ResourceNotFoundException('Community', communityId);
    const member = await this.communitiesRepository.findMember(
      communityId,
      userId,
    );
    if (!member)
      throw new ForbiddenActionException(
        'You are not a member of this community',
      );
    return community;
  }

  private async assertManager(communityId: string, userId: string) {
    const community = await this.communitiesRepository.findById(communityId);
    if (!community)
      throw new ResourceNotFoundException('Community', communityId);
    if (community.ownerId === userId) return community;

    const member = await this.communitiesRepository.findMember(
      communityId,
      userId,
    );
    const permissions = member?.roles.flatMap((r) => r.role.permissions) ?? [];
    const canManage = permissions.some((p) => MANAGE_PERMISSIONS.includes(p));
    if (!canManage)
      throw new ForbiddenActionException(
        'You do not have permission to manage this community',
      );
    return community;
  }

  async join(userId: string, communityId: string) {
    const community = await this.communitiesRepository.findById(communityId);
    if (!community)
      throw new ResourceNotFoundException('Community', communityId);

    const existing = await this.communitiesRepository.findMember(
      communityId,
      userId,
    );
    if (existing)
      throw new ConflictException('You are already a member of this community');

    return this.communitiesRepository.addMember(communityId, userId);
  }

  async leave(userId: string, communityId: string) {
    const community = await this.communitiesRepository.findById(communityId);
    if (!community)
      throw new ResourceNotFoundException('Community', communityId);
    if (community.ownerId === userId) {
      throw new ForbiddenActionException(
        'The owner cannot leave — transfer ownership or delete the community',
      );
    }
    await this.communitiesRepository.removeMember(communityId, userId);
  }

  async update(
    userId: string,
    communityId: string,
    data: { name?: string; tag?: string; accentColor?: string },
  ) {
    await this.assertManager(communityId, userId);
    return this.communitiesRepository.update(communityId, data);
  }

  async delete(userId: string, communityId: string) {
    const community = await this.communitiesRepository.findById(communityId);
    if (!community)
      throw new ResourceNotFoundException('Community', communityId);
    if (community.ownerId !== userId)
      throw new ForbiddenActionException(
        'Only the owner can delete this community',
      );
    await this.communitiesRepository.delete(communityId);
  }

  listMembers(communityId: string) {
    return this.communitiesRepository.listMembers(communityId);
  }

  async kickMember(userId: string, communityId: string, targetUserId: string) {
    const community = await this.assertManager(communityId, userId);
    if (targetUserId === community.ownerId)
      throw new ForbiddenActionException('Cannot remove the owner');
    await this.communitiesRepository.removeMember(communityId, targetUserId);
  }

  async createChannelGroup(
    userId: string,
    communityId: string,
    name: string,
    position = 0,
  ) {
    await this.assertManager(communityId, userId);
    return this.communitiesRepository.createChannelGroup(
      communityId,
      name,
      position,
    );
  }

  async createChannel(
    userId: string,
    communityId: string,
    channelGroupId: string,
    name: string,
    type: ChannelType,
    position = 0,
  ) {
    await this.assertManager(communityId, userId);
    return this.communitiesRepository.createChannel(
      communityId,
      channelGroupId,
      name,
      type,
      position,
    );
  }

  async deleteChannel(userId: string, communityId: string, channelId: string) {
    await this.assertManager(communityId, userId);
    await this.communitiesRepository.deleteChannel(communityId, channelId);
  }

  async createRole(
    userId: string,
    communityId: string,
    name: string,
    color: string,
    permissions: string[],
    position = 0,
  ) {
    await this.assertManager(communityId, userId);
    return this.communitiesRepository.createRole(
      communityId,
      name,
      color,
      permissions,
      position,
    );
  }

  async deleteRole(userId: string, communityId: string, roleId: string) {
    await this.assertManager(communityId, userId);
    await this.communitiesRepository.deleteRole(communityId, roleId);
  }

  async assignRole(
    userId: string,
    communityId: string,
    targetUserId: string,
    roleId: string,
  ) {
    await this.assertManager(communityId, userId);
    const [member, role] = await Promise.all([
      this.communitiesRepository.findMember(communityId, targetUserId),
      this.communitiesRepository.findRoleInCommunity(communityId, roleId),
    ]);
    if (!member)
      throw new ResourceNotFoundException('Community member', targetUserId);
    // Without this check a manager could assign a role that belongs to a
    // different community onto a member here — the role's `permissions`
    // would still apply within this community's UI/logic.
    if (!role) throw new ResourceNotFoundException('Role', roleId);
    return this.communitiesRepository.assignRole(member.id, roleId);
  }

  async unassignRole(
    userId: string,
    communityId: string,
    targetUserId: string,
    roleId: string,
  ) {
    await this.assertManager(communityId, userId);
    const [member, role] = await Promise.all([
      this.communitiesRepository.findMember(communityId, targetUserId),
      this.communitiesRepository.findRoleInCommunity(communityId, roleId),
    ]);
    if (!member)
      throw new ResourceNotFoundException('Community member', targetUserId);
    if (!role) throw new ResourceNotFoundException('Role', roleId);
    await this.communitiesRepository.unassignRole(member.id, roleId);
  }

  async createEvent(
    userId: string,
    communityId: string,
    title: string,
    date: string,
    game?: string,
  ) {
    await this.getByIdForMember(userId, communityId);
    return this.communitiesRepository.createEvent(
      communityId,
      title,
      new Date(date),
      game,
    );
  }

  async listEvents(userId: string, communityId: string) {
    await this.getByIdForMember(userId, communityId);
    return this.communitiesRepository.listEvents(communityId);
  }

  async createAnnouncement(
    userId: string,
    communityId: string,
    title: string,
    body: string,
  ) {
    await this.assertManager(communityId, userId);
    return this.communitiesRepository.createAnnouncement(
      communityId,
      userId,
      title,
      body,
    );
  }

  async listAnnouncements(userId: string, communityId: string) {
    await this.getByIdForMember(userId, communityId);
    return this.communitiesRepository.listAnnouncements(communityId);
  }

  private assertChannelInCommunity(
    community: { channelGroups: { channels: { id: string; type: ChannelType }[] }[] },
    channelId: string,
  ) {
    const channel = community.channelGroups
      .flatMap((g) => g.channels)
      .find((c) => c.id === channelId);
    if (!channel)
      throw new ResourceNotFoundException('Channel', channelId);
    return channel;
  }

  async listChannelMessages(
    userId: string,
    communityId: string,
    channelId: string,
    page: number,
    limit: number,
  ) {
    const community = await this.getByIdForMember(userId, communityId);
    this.assertChannelInCommunity(community, channelId);
    const { items, total } = await this.communitiesRepository.listChannelMessages(
      channelId,
      page,
      limit,
    );
    return paginate(items, total, page, limit);
  }

  async sendChannelMessage(
    userId: string,
    communityId: string,
    channelId: string,
    content: string,
  ) {
    const community = await this.getByIdForMember(userId, communityId);
    const channel = this.assertChannelInCommunity(community, channelId);
    if (channel.type !== ChannelType.TEXT && channel.type !== ChannelType.ANNOUNCEMENT)
      throw new ForbiddenActionException('This channel does not support text messages');

    const message = await this.communitiesRepository.createChannelMessage(
      channelId,
      userId,
      content,
    );
    this.eventEmitter.emit(CHANNEL_MESSAGE_CREATED_EVENT, {
      communityId,
      channelId,
      message,
    });
    return message;
  }
}
