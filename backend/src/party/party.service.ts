import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PartyMemberRole, VoiceRoomKind } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LiveKitService } from '../shared/livekit/livekit.service';
import {
  ConflictException,
  ForbiddenActionException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';
import { PartyRepository } from './party.repository';
import { FriendsService } from '../friends/friends.service';

export const PARTY_UPDATED_EVENT = 'party.updated';
export const PARTY_ENDED_EVENT = 'party.ended';
export const PARTY_INVITE_CREATED_EVENT = 'party.invite.created';

export interface PartyEndedPayload {
  partyId: string;
  reason: 'host_left' | 'empty';
}

export interface PartyInviteCreatedPayload {
  inviteeId: string;
  invite: {
    id: string;
    partyId: string;
    partyName: string;
    partyGame: string | null;
    inviterId: string;
    inviterName: string;
    inviterAvatarColor: string;
    createdAt: Date;
  };
}

@Injectable()
export class PartyService {
  constructor(
    private readonly partyRepository: PartyRepository,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly liveKitService: LiveKitService,
    private readonly eventEmitter: EventEmitter2,
    private readonly friendsService: FriendsService,
  ) {}

  async create(userId: string, name: string, game?: string, maxSize?: number) {
    const existing = await this.partyRepository.findActiveForUser(userId);
    if (existing)
      throw new ConflictException(
        'You are already in a party. Leave it before creating a new one.',
      );

    const voiceRoom = await this.prisma.voiceRoom.create({
      data: { kind: VoiceRoomKind.PARTY, livekitName: `party-${randomUUID()}` },
    });
    await this.liveKitService.ensureRoom(voiceRoom.livekitName);

    const party = await this.partyRepository.create({
      name,
      game,
      ownerId: userId,
      maxSize,
      voiceRoomId: voiceRoom.id,
    });
    return party;
  }

  getActiveForUser(userId: string) {
    return this.partyRepository.findActiveForUser(userId);
  }

  async getByIdForMember(userId: string, partyId: string) {
    const party = await this.partyRepository.findById(partyId);
    if (!party) throw new ResourceNotFoundException('Party', partyId);
    const isMember = party.members.some((m) => m.userId === userId);
    if (!isMember)
      throw new ForbiddenActionException('You are not a member of this party');
    return party;
  }

  private async assertLeader(partyId: string, userId: string) {
    const member = await this.partyRepository.findMember(partyId, userId);
    if (!member || member.role !== PartyMemberRole.LEADER) {
      throw new ForbiddenActionException('Only the party leader can do this');
    }
  }

  async invite(userId: string, partyId: string, inviteeId: string) {
    const party = await this.getByIdForMember(userId, partyId);
    if (party.members.length >= party.maxSize)
      throw new ConflictException('Party is full');
    if (party.members.some((m) => m.userId === inviteeId)) {
      throw new ConflictException('This user is already in the party');
    }

    const invite = await this.partyRepository.createInvite(
      partyId,
      userId,
      inviteeId,
    );
    await this.notificationsService.create({
      recipientId: inviteeId,
      actorId: userId,
      type: 'PARTY_INVITE',
      title: 'Party invite',
      body: `You've been invited to join "${party.name}".`,
    });

    // Real-time popup for the invitee, in addition to the persisted
    // notification above: the notification covers "check later", this
    // covers "show me a Join/Decline prompt right now" while they're online.
    const inviter = await this.prisma.user.findUnique({ where: { id: userId } });
    this.eventEmitter.emit(PARTY_INVITE_CREATED_EVENT, {
      inviteeId,
      invite: {
        id: invite.id,
        partyId: party.id,
        partyName: party.name,
        partyGame: party.game,
        inviterId: userId,
        inviterName: inviter?.displayName ?? 'Someone',
        inviterAvatarColor: inviter?.avatarColor ?? '#f2691c',
        createdAt: invite.createdAt,
      },
    } satisfies PartyInviteCreatedPayload);

    return invite;
  }

  /**
   * "Public party" mode: instead of the organizer picking specific
   * friends one at a time, invite every friend at once. Reuses the exact
   * same PartyInvite + Notification pipeline as a single invite — each
   * friend gets their own real, individually-acceptable invite, not a
   * broadcast notification with no persisted trail. Friends who are
   * already members or already have a pending invite are silently
   * skipped rather than erroring the whole batch.
   */
  async inviteAllFriends(userId: string, partyId: string) {
    const party = await this.getByIdForMember(userId, partyId);
    const friends = await this.friendsService.listFriends(userId);
    const existingInvites = await this.partyRepository.findIncomingInvitesForParty(partyId);
    const alreadyInvitedIds = new Set(
      existingInvites.filter((i) => !i.respondedAt).map((i) => i.inviteeId),
    );
    const memberIds = new Set(party.members.map((m) => m.userId));

    const spaceLeft = party.maxSize - party.members.length;
    const targets = friends
      .map((f) => f.friend.id)
      .filter((id) => !memberIds.has(id) && !alreadyInvitedIds.has(id))
      .slice(0, Math.max(spaceLeft, 0));

    const results = await Promise.allSettled(
      targets.map((inviteeId) => this.invite(userId, partyId, inviteeId)),
    );
    const invited = results.filter((r) => r.status === 'fulfilled').length;
    return { invited, totalFriends: friends.length };
  }

  async listIncomingInvites(userId: string) {
    const invites = await this.partyRepository.findIncomingInvites(userId);
    const inviterIds = [...new Set(invites.map((i) => i.inviterId))];
    const inviters = inviterIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: inviterIds } } })
      : [];
    const inviterById = new Map(inviters.map((u) => [u.id, u]));
    return invites.map((invite) => ({
      ...invite,
      inviter: inviterById.get(invite.inviterId) ?? null,
    }));
  }

  async respondToInvite(userId: string, inviteId: string, accept: boolean) {
    const invite = await this.partyRepository.findInvite(inviteId);
    if (!invite || invite.inviteeId !== userId)
      throw new ResourceNotFoundException('Party invite', inviteId);
    if (invite.respondedAt)
      throw new ConflictException('This invite has already been responded to');
    if (accept && invite.party.members.length >= invite.party.maxSize) {
      throw new ConflictException('Party is full');
    }

    const result = await this.partyRepository.respondInviteAtomic(
      inviteId,
      invite.partyId,
      userId,
      accept,
    );
    if (!result) {
      // Lost the race to a concurrent response on the same invite.
      throw new ConflictException('This invite has already been responded to');
    }

    if (accept) {
      const party = await this.partyRepository.findById(invite.partyId);
      this.eventEmitter.emit(PARTY_UPDATED_EVENT, {
        partyId: invite.partyId,
        party,
      });
      return party;
    }
    return null;
  }

  async leave(userId: string, partyId: string) {
    const party = await this.getByIdForMember(userId, partyId);
    const isLeader =
      party.members.find((m) => m.userId === userId)?.role ===
      PartyMemberRole.LEADER;

    // The host leaving ends the party for everyone, immediately — no
    // leadership handoff. Members still connected get a party:ended
    // event (see RealtimeGateway) and their client clears the party and
    // drops voice; anyone who reconnects later just finds it gone.
    if (isLeader) {
      if (party.voiceRoom)
        await this.liveKitService.closeRoom(party.voiceRoom.livekitName);
      await this.partyRepository.delete(partyId);
      this.eventEmitter.emit(PARTY_ENDED_EVENT, {
        partyId,
        reason: 'host_left',
      } satisfies PartyEndedPayload);
      return null;
    }

    await this.partyRepository.removeMember(partyId, userId);

    const remaining = await this.partyRepository.countMembers(partyId);
    if (remaining === 0) {
      if (party.voiceRoom)
        await this.liveKitService.closeRoom(party.voiceRoom.livekitName);
      await this.partyRepository.delete(partyId);
      this.eventEmitter.emit(PARTY_ENDED_EVENT, {
        partyId,
        reason: 'empty',
      } satisfies PartyEndedPayload);
      return null;
    }

    const updated = await this.partyRepository.findById(partyId);
    this.eventEmitter.emit(PARTY_UPDATED_EVENT, { partyId, party: updated });
    return updated;
  }

  async kickMember(userId: string, partyId: string, targetUserId: string) {
    await this.assertLeader(partyId, userId);
    if (targetUserId === userId)
      throw new ForbiddenActionException(
        'Use leave instead of kicking yourself',
      );
    await this.partyRepository.removeMember(partyId, targetUserId);
    const updated = await this.partyRepository.findById(partyId);
    this.eventEmitter.emit(PARTY_UPDATED_EVENT, { partyId, party: updated });
    return updated;
  }

  async transferOwnership(
    userId: string,
    partyId: string,
    targetUserId: string,
  ) {
    await this.assertLeader(partyId, userId);
    const target = await this.partyRepository.findMember(partyId, targetUserId);
    if (!target)
      throw new ResourceNotFoundException('Party member', targetUserId);

    await this.partyRepository.setMemberRole(
      partyId,
      userId,
      PartyMemberRole.MEMBER,
    );
    await this.partyRepository.setMemberRole(
      partyId,
      targetUserId,
      PartyMemberRole.LEADER,
    );
    const updated = await this.partyRepository.update(partyId, {
      owner: { connect: { id: targetUserId } },
    });
    this.eventEmitter.emit(PARTY_UPDATED_EVENT, { partyId, party: updated });
    return updated;
  }

  async updateSettings(
    userId: string,
    partyId: string,
    data: { openInvites?: boolean; regionLocked?: boolean; region?: string },
  ) {
    await this.assertLeader(partyId, userId);
    const updated = await this.partyRepository.update(partyId, data);
    this.eventEmitter.emit(PARTY_UPDATED_EVENT, { partyId, party: updated });
    return updated;
  }

  async setMemberVoiceState(
    userId: string,
    partyId: string,
    data: { muted?: boolean; deafened?: boolean },
  ) {
    await this.getByIdForMember(userId, partyId);
    const updated = await this.partyRepository.updateMember(
      partyId,
      userId,
      data,
    );
    this.eventEmitter.emit(PARTY_UPDATED_EVENT, {
      partyId,
      party: await this.partyRepository.findById(partyId),
    });
    return updated;
  }

  async getVoiceGrant(userId: string, partyId: string) {
    const party = await this.getByIdForMember(userId, partyId);
    if (!party.voiceRoom)
      throw new ResourceNotFoundException('Voice room for party', partyId);
    return this.liveKitService.createAccessToken({
      roomName: party.voiceRoom.livekitName,
      identity: userId,
      name: userId,
    });
  }
}
