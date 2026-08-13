import { Injectable } from '@nestjs/common';
import { ChannelType, CommunityMemberStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ResourceNotFoundException } from '../common/exceptions/app.exceptions';

const communityInclude = {
  owner: true,
  channelGroups: { include: { channels: true }, orderBy: { position: 'asc' } },
  roles: { orderBy: { position: 'asc' } },
  _count: { select: { members: true } },
} satisfies Prisma.CommunityInclude;

@Injectable()
export class CommunitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, name: string, tag: string) {
    return this.prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name,
          tag,
          ownerId,
          members: {
            create: { userId: ownerId, status: CommunityMemberStatus.ACTIVE },
          },
          roles: {
            create: [
              {
                name: 'Founder',
                color: '#f2691c',
                permissions: ['ADMINISTRATOR'],
                position: 0,
              },
              {
                name: 'Member',
                color: '#9aa0a8',
                permissions: ['SEND_MESSAGES', 'JOIN_VOICE'],
                position: 1,
              },
            ],
          },
          channelGroups: {
            create: [
              {
                name: 'Text',
                position: 0,
                channels: {
                  create: [
                    { name: 'general', type: ChannelType.TEXT, position: 0 },
                  ],
                },
              },
              {
                name: 'Voice',
                position: 1,
                channels: {
                  create: [
                    {
                      name: 'Main Lobby',
                      type: ChannelType.VOICE,
                      position: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
        include: communityInclude,
      });

      const founderRole = community.roles.find((r) => r.name === 'Founder');
      if (founderRole) {
        const ownerMember = await tx.communityMember.findUnique({
          where: {
            communityId_userId: { communityId: community.id, userId: ownerId },
          },
        });
        if (ownerMember) {
          await tx.communityMemberRole.create({
            data: { communityMemberId: ownerMember.id, roleId: founderRole.id },
          });
        }
      }

      return community;
    });
  }

  findById(id: string) {
    return this.prisma.community.findUnique({
      where: { id },
      include: communityInclude,
    });
  }

  listForUser(userId: string) {
    return this.prisma.community.findMany({
      where: {
        members: { some: { userId, status: CommunityMemberStatus.ACTIVE } },
      },
      include: communityInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  listPublic(query: string | undefined, limit: number) {
    return this.prisma.community.findMany({
      where: query
        ? { name: { contains: query, mode: 'insensitive' } }
        : undefined,
      include: communityInclude,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.CommunityUpdateInput) {
    return this.prisma.community.update({
      where: { id },
      data,
      include: communityInclude,
    });
  }

  delete(id: string) {
    return this.prisma.community.delete({ where: { id } });
  }

  findMember(communityId: string, userId: string) {
    return this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
      include: { roles: { include: { role: true } }, user: true },
    });
  }

  listMembers(communityId: string) {
    return this.prisma.communityMember.findMany({
      where: { communityId, status: CommunityMemberStatus.ACTIVE },
      include: { user: true, roles: { include: { role: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(communityId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.communityMember.create({
        data: { communityId, userId, status: CommunityMemberStatus.ACTIVE },
        include: { user: true },
      });
      const memberRole = await tx.communityRole.findFirst({
        where: { communityId, name: 'Member' },
      });
      if (memberRole) {
        await tx.communityMemberRole.create({
          data: { communityMemberId: member.id, roleId: memberRole.id },
        });
      }
      return member;
    });
  }

  removeMember(communityId: string, userId: string) {
    return this.prisma.communityMember.delete({
      where: { communityId_userId: { communityId, userId } },
    });
  }

  setMemberStatus(
    communityId: string,
    userId: string,
    status: CommunityMemberStatus,
  ) {
    return this.prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId } },
      data: { status },
    });
  }

  createChannelGroup(communityId: string, name: string, position: number) {
    return this.prisma.channelGroup.create({
      data: { communityId, name, position },
    });
  }

  createChannel(
    communityId: string,
    channelGroupId: string,
    name: string,
    type: ChannelType,
    position: number,
  ) {
    // channelGroupId is scoped to communityId here so a manager of one
    // community can't create a channel inside another community's
    // channel group by supplying a foreign channelGroupId.
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.channelGroup.findFirst({
        where: { id: channelGroupId, communityId },
        select: { id: true },
      });
      if (!group) {
        throw new ResourceNotFoundException('Channel group', channelGroupId);
      }
      return tx.channel.create({
        data: { channelGroupId, name, type, position },
      });
    });
  }

  async deleteChannel(communityId: string, id: string) {
    // Scoped delete: only removes the channel if it actually belongs to
    // this community, closing an IDOR where a manager of community A
    // could delete a channel belonging to community B by ID.
    const result = await this.prisma.channel.deleteMany({
      where: { id, channelGroup: { communityId } },
    });
    if (result.count === 0) {
      throw new ResourceNotFoundException('Channel', id);
    }
  }

  createRole(
    communityId: string,
    name: string,
    color: string,
    permissions: string[],
    position: number,
  ) {
    return this.prisma.communityRole.create({
      data: { communityId, name, color, permissions, position },
    });
  }

  async deleteRole(communityId: string, id: string) {
    // Scoped delete for the same reason as deleteChannel above — prevents
    // a manager of one community from deleting another community's role.
    const result = await this.prisma.communityRole.deleteMany({
      where: { id, communityId },
    });
    if (result.count === 0) {
      throw new ResourceNotFoundException('Role', id);
    }
  }

  findRoleInCommunity(communityId: string, roleId: string) {
    return this.prisma.communityRole.findFirst({
      where: { id: roleId, communityId },
    });
  }

  assignRole(communityMemberId: string, roleId: string) {
    return this.prisma.communityMemberRole.upsert({
      where: { communityMemberId_roleId: { communityMemberId, roleId } },
      create: { communityMemberId, roleId },
      update: {},
    });
  }

  unassignRole(communityMemberId: string, roleId: string) {
    return this.prisma.communityMemberRole.deleteMany({
      where: { communityMemberId, roleId },
    });
  }

  createEvent(communityId: string, title: string, date: Date, game?: string) {
    return this.prisma.communityEvent.create({
      data: { communityId, title, date, game },
    });
  }

  listEvents(communityId: string) {
    return this.prisma.communityEvent.findMany({
      where: { communityId },
      orderBy: { date: 'asc' },
    });
  }

  createAnnouncement(
    communityId: string,
    authorId: string,
    title: string,
    body: string,
  ) {
    return this.prisma.announcement.create({
      data: { communityId, authorId, title, body },
    });
  }

  listAnnouncements(communityId: string) {
    return this.prisma.announcement.findMany({
      where: { communityId },
      orderBy: { postedAt: 'desc' },
    });
  }
}
