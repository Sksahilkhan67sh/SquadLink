import { Injectable } from '@nestjs/common';
import { PartyMemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const partyInclude = {
  members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
  owner: true,
  voiceRoom: true,
} satisfies Prisma.PartyInclude;

@Injectable()
export class PartyRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    name: string;
    game?: string;
    ownerId: string;
    maxSize?: number;
    voiceRoomId?: string;
  }) {
    return this.prisma.party.create({
      data: {
        name: data.name,
        game: data.game,
        ownerId: data.ownerId,
        maxSize: data.maxSize ?? 5,
        voiceRoomId: data.voiceRoomId,
        members: {
          create: [{ userId: data.ownerId, role: PartyMemberRole.LEADER }],
        },
      },
      include: partyInclude,
    });
  }

  findById(id: string) {
    return this.prisma.party.findUnique({
      where: { id },
      include: partyInclude,
    });
  }

  findActiveForUser(userId: string) {
    return this.prisma.party.findFirst({
      where: { members: { some: { userId } } },
      include: partyInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.PartyUpdateInput) {
    return this.prisma.party.update({
      where: { id },
      data,
      include: partyInclude,
    });
  }

  delete(id: string) {
    return this.prisma.party.delete({ where: { id } });
  }

  addMember(
    partyId: string,
    userId: string,
    role: PartyMemberRole = PartyMemberRole.MEMBER,
  ) {
    return this.prisma.partyMember.create({
      data: { partyId, userId, role },
      include: { user: true },
    });
  }

  removeMember(partyId: string, userId: string) {
    return this.prisma.partyMember.delete({
      where: { partyId_userId: { partyId, userId } },
    });
  }

  findMember(partyId: string, userId: string) {
    return this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId } },
    });
  }

  countMembers(partyId: string) {
    return this.prisma.partyMember.count({ where: { partyId } });
  }

  updateMember(
    partyId: string,
    userId: string,
    data: Prisma.PartyMemberUpdateInput,
  ) {
    return this.prisma.partyMember.update({
      where: { partyId_userId: { partyId, userId } },
      data,
    });
  }

  setMemberRole(partyId: string, userId: string, role: PartyMemberRole) {
    return this.prisma.partyMember.update({
      where: { partyId_userId: { partyId, userId } },
      data: { role },
    });
  }

  createInvite(partyId: string, inviterId: string, inviteeId: string) {
    return this.prisma.partyInvite.create({
      data: { partyId, inviterId, inviteeId },
    });
  }

  findInvite(id: string) {
    return this.prisma.partyInvite.findUnique({
      include: { party: { include: partyInclude } },
      where: { id },
    });
  }

  findIncomingInvites(userId: string) {
    return this.prisma.partyInvite.findMany({
      where: { inviteeId: userId, respondedAt: null },
      include: { party: { include: partyInclude } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findIncomingInvitesForParty(partyId: string) {
    return this.prisma.partyInvite.findMany({ where: { partyId } });
  }

  respondInvite(id: string, accepted: boolean) {
    return this.prisma.partyInvite.update({
      where: { id },
      data: { accepted, respondedAt: new Date() },
    });
  }

  /**
   * Atomically responds to an invite and (on accept) adds the member.
   * The invite update is conditioned on respondedAt still being null so
   * two concurrent responses can't both succeed — the loser's updateMany
   * matches zero rows and the call returns null.
   */
  async respondInviteAtomic(
    inviteId: string,
    partyId: string,
    userId: string,
    accepted: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.partyInvite.updateMany({
        where: { id: inviteId, respondedAt: null },
        data: { accepted, respondedAt: new Date() },
      });
      if (count === 0) return null;
      if (accepted) {
        await tx.partyMember.create({ data: { partyId, userId } });
      }
      return { responded: true };
    });
  }

  attachVoiceRoom(partyId: string, voiceRoomId: string) {
    return this.prisma.party.update({
      where: { id: partyId },
      data: { voiceRoom: { connect: { id: voiceRoomId } } },
      include: partyInclude,
    });
  }
}
