import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LiveKitService } from '../shared/livekit/livekit.service';
import {
  ForbiddenActionException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';
import { VoiceRepository } from './voice.repository';

@Injectable()
export class VoiceService {
  constructor(
    private readonly voiceRepository: VoiceRepository,
    private readonly liveKitService: LiveKitService,
  ) {}

  async joinChannel(userId: string, channelId: string, displayName: string) {
    const channel = await this.voiceRepository.findChannelWithMembership(
      channelId,
      userId,
    );
    if (!channel)
      throw new ResourceNotFoundException('Voice channel', channelId);
    if (channel.type !== 'VOICE')
      throw new ForbiddenActionException('This channel is not a voice channel');
    if (channel.channelGroup.community.members.length === 0) {
      throw new ForbiddenActionException(
        'You are not a member of this community',
      );
    }

    let voiceRoom = channel.voiceRoom;
    if (!voiceRoom) {
      voiceRoom = await this.voiceRepository.createVoiceRoomForChannel(
        channelId,
        `channel-${randomUUID()}`,
      );
    }
    await this.liveKitService.ensureRoom(voiceRoom.livekitName);

    return this.liveKitService.createAccessToken({
      roomName: voiceRoom.livekitName,
      identity: userId,
      name: displayName,
    });
  }

  /**
   * Reconnect issues a fresh short-lived token for a room the client was
   * already in — used after a network drop. Membership is re-verified on
   * every call (not just at join time): without this check any
   * authenticated user who learned or guessed a `roomName` could mint a
   * LiveKit token for a voice channel or party they don't belong to.
   */
  async reconnect(userId: string, displayName: string, roomName: string) {
    const room = await this.voiceRepository.findVoiceRoomWithMembership(
      roomName,
      userId,
    );
    if (!room || room.closedAt) {
      throw new ResourceNotFoundException('Voice room', roomName);
    }

    const communityMemberCount =
      room.channel?.channelGroup.community.members.length ?? 0;
    const partyMemberCount = room.party?.members.length ?? 0;
    const isCommunityMember = communityMemberCount > 0;
    const isPartyMember = partyMemberCount > 0;

    if (!isCommunityMember && !isPartyMember) {
      throw new ForbiddenActionException(
        'You are not a member of this voice room',
      );
    }

    return this.liveKitService.createAccessToken({
      roomName: room.livekitName,
      identity: userId,
      name: displayName,
    });
  }
}
