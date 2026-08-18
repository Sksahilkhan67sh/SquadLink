import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../shared/redis/redis.service';
import { PrismaService } from '../database/prisma.service';
import { redactSensitiveFields } from '../common/utils/redact-sensitive-fields';
import { JwtPayload } from '../auth/tokens.service';
import { WsJwtGuard, AuthenticatedSocket } from './ws-jwt.guard';
import {
  MESSAGE_CREATED_EVENT,
  MESSAGE_UPDATED_EVENT,
} from '../messages/messages.service';
import {
  NOTIFICATION_CREATED_EVENT,
  NotificationCreatedPayload,
} from '../notifications/notifications.service';
import {
  PARTY_UPDATED_EVENT,
  PARTY_ENDED_EVENT,
  PARTY_INVITE_CREATED_EVENT,
  PartyEndedPayload,
  PartyInviteCreatedPayload,
} from '../party/party.service';
import { CHANNEL_MESSAGE_CREATED_EVENT } from '../communities/communities.service';

function userRoom(userId: string) {
  return `user:${userId}`;
}
function conversationRoom(conversationId: string) {
  return `conversation:${conversationId}`;
}
function partyRoom(partyId: string) {
  return `party:${partyId}`;
}
function channelRoom(channelId: string) {
  return `channel:${channelId}`;
}

interface PendingCall {
  callId: string;
  partyId: string;
  callerId: string;
  memberIds: Set<string>;
  respondedIds: Set<string>;
  timeout: NodeJS.Timeout;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly socketsByUser = new Map<string, Set<string>>();

  // Ephemeral call-invitation state — a call invite is short-lived
  // signaling (like a typing indicator), not persistent app data, so it
  // lives in memory here rather than as a new Prisma model/migration.
  // Auto-expires if nobody responds so a caller's UI doesn't ring forever.
  private readonly pendingCalls = new Map<string, PendingCall>();
  private static readonly CALL_RING_TIMEOUT_MS = 30_000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token supplied');

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });
      (client as AuthenticatedSocket).data.user = {
        id: payload.sub,
        email: payload.email,
        handle: payload.handle,
      };

      const userId = payload.sub;
      void client.join(userRoom(userId));

      const sockets = this.socketsByUser.get(userId) ?? new Set<string>();
      const wasOffline = sockets.size === 0;
      sockets.add(client.id);
      this.socketsByUser.set(userId, sockets);

      if (wasOffline) {
        await this.usersService.updatePresence(userId, { status: 'ONLINE' });
        await this.redisService.setPresence(userId, 'ONLINE');
        this.server.emit('presence:update', { userId, status: 'ONLINE' });
      }
    } catch (err) {
      this.logger.warn(`Rejected socket connection: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = (client as AuthenticatedSocket).data?.user?.id;
    if (!userId) return;

    const sockets = this.socketsByUser.get(userId);
    sockets?.delete(client.id);

    if (!sockets || sockets.size === 0) {
      this.socketsByUser.delete(userId);
      await this.usersService.setOffline(userId);
      await this.redisService.setPresence(userId, 'OFFLINE');
      this.server.emit('presence:update', { userId, status: 'OFFLINE' });

      for (const [callId, call] of this.pendingCalls) {
        if (call.callerId !== userId) continue;
        clearTimeout(call.timeout);
        this.pendingCalls.delete(callId);
        for (const memberId of call.memberIds) {
          this.server
            .to(userRoom(memberId))
            .emit('call:cancelled', { callId, partyId: call.partyId });
        }
      }
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }

  // -------------------------------------------------------------------
  // Authorization helpers
  //
  // Room membership must be re-checked here, not assumed from the REST
  // API: a socket can request any conversationId/partyId directly, so
  // without these checks a client could join another user's conversation
  // or party room and silently receive their messages / updates.
  // -------------------------------------------------------------------

  private async isConversationParticipant(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return participant !== null;
  }

  private async isPartyMember(
    partyId: string,
    userId: string,
  ): Promise<boolean> {
    const member = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId } },
    });
    return member !== null;
  }

  private async isChannelMemberByCommunity(
    channelId: string,
    userId: string,
  ): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { channelGroup: { select: { communityId: true } } },
    });
    if (!channel) return false;
    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: channel.channelGroup.communityId,
          userId,
        },
      },
    });
    return member !== null;
  }

  // Starting a voice call rings every other party member, so this is
  // restricted to the party leader (same as kicking members / settings) to
  // stop any invited member from blasting a ring to the whole party.
  private async isPartyLeader(
    partyId: string,
    userId: string,
  ): Promise<boolean> {
    const member = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId } },
    });
    return member?.role === 'LEADER';
  }

  // -------------------------------------------------------------------
  // Client -> server events
  // -------------------------------------------------------------------

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('conversation:join')
  async onJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const allowed = await this.isConversationParticipant(
      data.conversationId,
      client.data.user.id,
    );
    if (!allowed) {
      client.emit('error', {
        message: 'Not a participant of this conversation',
      });
      return;
    }
    void client.join(conversationRoom(data.conversationId));
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('conversation:leave')
  onLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    void client.leave(conversationRoom(data.conversationId));
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.rooms.has(conversationRoom(data.conversationId))) return;
    client.to(conversationRoom(data.conversationId)).emit('typing:update', {
      conversationId: data.conversationId,
      userId: client.data.user.id,
      typing: true,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.rooms.has(conversationRoom(data.conversationId))) return;
    client.to(conversationRoom(data.conversationId)).emit('typing:update', {
      conversationId: data.conversationId,
      userId: client.data.user.id,
      typing: false,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('party:join')
  async onJoinParty(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { partyId: string },
  ) {
    const allowed = await this.isPartyMember(data.partyId, client.data.user.id);
    if (!allowed) {
      client.emit('error', { message: 'Not a member of this party' });
      return;
    }
    void client.join(partyRoom(data.partyId));
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('party:leave')
  onLeaveParty(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { partyId: string },
  ) {
    void client.leave(partyRoom(data.partyId));
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('channel:join')
  async onJoinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    const allowed = await this.isChannelMemberByCommunity(
      data.channelId,
      client.data.user.id,
    );
    if (!allowed) {
      client.emit('error', { message: 'Not a member of this channel' });
      return;
    }
    void client.join(channelRoom(data.channelId));
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('channel:leave')
  onLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    void client.leave(channelRoom(data.channelId));
  }

  // -------------------------------------------------------------------
  // Voice call invitations (party-scoped)
  //
  // A "call" here is pure signaling: who's ringing whom, and whether they
  // accepted or declined. The actual voice connection reuses the existing
  // party voice room + REST voice-token endpoint — every party already
  // has a VoiceRoom created at party-creation time (see PartyService.create),
  // so accepting a call is just the callee calling that endpoint like any
  // other "join voice" action. This handler only exists to make joining
  // an *invitation* (ring → accept/decline) instead of a silent join.
  // -------------------------------------------------------------------

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call:invite')
  async onCallInvite(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { partyId: string },
  ) {
    const callerId = client.data.user.id;
    const allowed = await this.isPartyMember(data.partyId, callerId);
    if (!allowed) {
      client.emit('error', { message: 'Not a member of this party' });
      return;
    }

    const isLeader = await this.isPartyLeader(data.partyId, callerId);
    if (!isLeader) {
      client.emit('error', {
        message: 'Only the party leader can start a voice call',
      });
      return;
    }

    const party = await this.prisma.party.findUnique({
      where: { id: data.partyId },
      select: {
        name: true,
        members: { select: { userId: true } },
      },
    });
    if (!party) {
      client.emit('error', { message: 'Party not found' });
      return;
    }

    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { displayName: true, avatarColor: true },
    });

    const memberIds = new Set(
      party.members.map((m) => m.userId).filter((id) => id !== callerId),
    );
    if (memberIds.size === 0) {
      client.emit('error', { message: "You're the only one in this party" });
      return;
    }

    const callId = randomUUID();
    const timeout = setTimeout(() => {
      const call = this.pendingCalls.get(callId);
      if (!call) return;
      this.pendingCalls.delete(callId);
      this.server
        .to(userRoom(call.callerId))
        .emit('call:missed', { callId, partyId: call.partyId });
      for (const memberId of call.memberIds) {
        this.server
          .to(userRoom(memberId))
          .emit('call:cancelled', { callId, partyId: call.partyId });
      }
    }, RealtimeGateway.CALL_RING_TIMEOUT_MS);

    this.pendingCalls.set(callId, {
      callId,
      partyId: data.partyId,
      callerId,
      memberIds,
      respondedIds: new Set(),
      timeout,
    });

    const payload = {
      callId,
      partyId: data.partyId,
      partyName: party.name,
      callerId,
      callerName: caller?.displayName ?? 'Someone',
      callerAvatarColor: caller?.avatarColor ?? '#f2691c',
    };
    for (const memberId of memberIds) {
      this.server.to(userRoom(memberId)).emit('call:incoming', payload);
    }
    client.emit('call:ringing', { callId, partyId: data.partyId });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call:respond')
  onCallRespond(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { callId: string; accept: boolean },
  ) {
    const call = this.pendingCalls.get(data.callId);
    const userId = client.data.user.id;
    if (!call || !call.memberIds.has(userId)) return;

    call.respondedIds.add(userId);
    this.server.to(userRoom(call.callerId)).emit(
      data.accept ? 'call:accepted' : 'call:declined',
      { callId: data.callId, partyId: call.partyId, userId },
    );

    // Once everyone invited has responded, the invite is resolved — clear
    // the ring timeout so a late-but-complete response set doesn't still
    // fire a stale "missed call" after the fact.
    if (call.respondedIds.size >= call.memberIds.size) {
      clearTimeout(call.timeout);
      this.pendingCalls.delete(data.callId);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call:cancel')
  onCallCancel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { callId: string },
  ) {
    const call = this.pendingCalls.get(data.callId);
    if (!call || call.callerId !== client.data.user.id) return;

    clearTimeout(call.timeout);
    this.pendingCalls.delete(data.callId);
    for (const memberId of call.memberIds) {
      this.server
        .to(userRoom(memberId))
        .emit('call:cancelled', { callId: data.callId, partyId: call.partyId });
    }
  }

  // -------------------------------------------------------------------
  // Domain events (from services, via EventEmitter2) -> connected clients
  // -------------------------------------------------------------------

  @OnEvent(MESSAGE_CREATED_EVENT)
  handleMessageCreated(payload: {
    conversationId: string;
    message: unknown;
    recipientIds: string[];
  }) {
    const message = redactSensitiveFields(payload.message);
    this.server
      .to(conversationRoom(payload.conversationId))
      .emit('message:created', message);
    for (const recipientId of payload.recipientIds) {
      this.server.to(userRoom(recipientId)).emit('message:notify', message);
    }
  }

  @OnEvent(MESSAGE_UPDATED_EVENT)
  handleMessageUpdated(payload: { conversationId: string; message: unknown }) {
    this.server
      .to(conversationRoom(payload.conversationId))
      .emit('message:updated', redactSensitiveFields(payload.message));
  }

  @OnEvent(NOTIFICATION_CREATED_EVENT)
  handleNotificationCreated(payload: NotificationCreatedPayload) {
    this.server
      .to(userRoom(payload.recipientId))
      .emit(
        'notification:created',
        redactSensitiveFields(payload.notification),
      );
  }

  @OnEvent(PARTY_UPDATED_EVENT)
  handlePartyUpdated(payload: { partyId: string; party: unknown }) {
    this.server
      .to(partyRoom(payload.partyId))
      .emit('party:updated', redactSensitiveFields(payload.party));
  }

  // Host left (or the party otherwise emptied out): tell everyone still
  // in the room right away, so their client can drop the party and voice
  // connection instead of waiting on the next party:updated poll.
  @OnEvent(PARTY_ENDED_EVENT)
  handlePartyEnded(payload: PartyEndedPayload) {
    this.server.to(partyRoom(payload.partyId)).emit('party:ended', payload);
  }

  // Real-time invite popup: sent straight to the invitee's own socket
  // room (not the party room, since they're not a member yet).
  @OnEvent(PARTY_INVITE_CREATED_EVENT)
  handlePartyInviteCreated(payload: PartyInviteCreatedPayload) {
    this.server
      .to(userRoom(payload.inviteeId))
      .emit('party:invite', redactSensitiveFields(payload.invite));
  }

  @OnEvent(CHANNEL_MESSAGE_CREATED_EVENT)
  handleChannelMessageCreated(payload: {
    communityId: string;
    channelId: string;
    message: unknown;
  }) {
    this.server
      .to(channelRoom(payload.channelId))
      .emit('channel:message:created', {
        channelId: payload.channelId,
        message: redactSensitiveFields(payload.message),
      });
  }
}
