import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findChannelWithMembership(channelId: string, userId: string) {
    return this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        voiceRoom: true,
        channelGroup: {
          include: {
            community: {
              include: { members: { where: { userId } } },
            },
          },
        },
      },
    });
  }

  createVoiceRoomForChannel(channelId: string, livekitName: string) {
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.voiceRoom.create({
        data: { kind: 'COMMUNITY_CHANNEL', livekitName },
      });
      await tx.channel.update({
        where: { id: channelId },
        data: { voiceRoom: { connect: { id: room.id } } },
      });
      return room;
    });
  }

  findVoiceRoomByLivekitName(livekitName: string) {
    return this.prisma.voiceRoom.findUnique({ where: { livekitName } });
  }

  /**
   * Loads a voice room together with enough membership context to verify
   * the requesting user is actually allowed in it — covers both the
   * community-channel case and the party case. Used by reconnect() so a
   * fresh token can never be minted for a room the caller isn't part of.
   */
  findVoiceRoomWithMembership(livekitName: string, userId: string) {
    return this.prisma.voiceRoom.findUnique({
      where: { livekitName },
      include: {
        channel: {
          include: {
            channelGroup: {
              include: {
                community: {
                  include: { members: { where: { userId } } },
                },
              },
            },
          },
        },
        party: {
          include: {
            members: { where: { userId } },
          },
        },
      },
    });
  }
}
