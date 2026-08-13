import { Injectable, Logger } from '@nestjs/common';
import { AccessToken, RoomServiceClient, Room } from 'livekit-server-sdk';
import { AppConfigService } from '../../config/app-config.service';

export interface VoiceGrant {
  token: string;
  url: string | undefined;
  roomName: string;
}

/**
 * LiveKit integration hooks.
 *
 * Token generation is fully functional and requires no network access (it's
 * a local JWT signed with the LiveKit API key/secret). Room administration
 * (`createRoom` / `closeRoom`) calls LiveKit's server API and becomes a
 * no-op, logged hook when LIVEKIT_URL / keys are not configured, matching
 * the "integration hooks only" scope for Phase 2.
 */
@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private roomService: RoomServiceClient | null = null;

  constructor(private readonly config: AppConfigService) {
    const { apiKey, apiSecret, url } = this.config.liveKit;
    if (apiKey && apiSecret && url) {
      this.roomService = new RoomServiceClient(url, apiKey, apiSecret);
    }
  }

  private get isConfigured(): boolean {
    const { apiKey, apiSecret } = this.config.liveKit;
    return Boolean(apiKey && apiSecret);
  }

  async createAccessToken(params: {
    roomName: string;
    identity: string;
    name: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
  }): Promise<VoiceGrant> {
    const { apiKey, apiSecret, url } = this.config.liveKit;

    // The dev fallback secret below is checked into this repo, so it is
    // public knowledge — anyone who has ever seen this source file could
    // forge a valid-looking LiveKit token for any room if a production
    // deployment ever ran with it. A logged warning is easy to miss, so
    // in production this must hard-fail instead of silently issuing a
    // token nobody can trust.
    if (!this.isConfigured && this.config.isProduction) {
      throw new Error(
        'LIVEKIT_API_KEY/LIVEKIT_API_SECRET are not configured. Refusing to ' +
          'issue a voice token signed with the public dev fallback secret in production.',
      );
    }

    const key = apiKey ?? 'devkey';
    const secret = apiSecret ?? 'devsecret_devsecret_devsecret_32';

    if (!this.isConfigured) {
      this.logger.warn(
        'LIVEKIT_API_KEY/SECRET not set - issuing a token signed with a local dev key. Set real credentials before deploying.',
      );
    }

    const at = new AccessToken(key, secret, {
      identity: params.identity,
      name: params.name,
      ttl: '10m',
    });
    at.addGrant({
      room: params.roomName,
      roomJoin: true,
      canPublish: params.canPublish ?? true,
      canSubscribe: params.canSubscribe ?? true,
    });

    return {
      token: await at.toJwt(),
      url,
      roomName: params.roomName,
    };
  }

  async ensureRoom(roomName: string): Promise<void> {
    if (!this.roomService) {
      this.logger.debug(
        `[hook] ensureRoom(${roomName}) skipped - LiveKit server API not configured`,
      );
      return;
    }
    try {
      const rooms: Room[] = await this.roomService.listRooms([roomName]);
      if (rooms.length === 0) {
        await this.roomService.createRoom({
          name: roomName,
          emptyTimeout: 300,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Could not ensure LiveKit room '${roomName}': ${(err as Error).message}`,
      );
    }
  }

  async closeRoom(roomName: string): Promise<void> {
    if (!this.roomService) {
      this.logger.debug(
        `[hook] closeRoom(${roomName}) skipped - LiveKit server API not configured`,
      );
      return;
    }
    try {
      await this.roomService.deleteRoom(roomName);
    } catch (err) {
      this.logger.warn(
        `Could not close LiveKit room '${roomName}': ${(err as Error).message}`,
      );
    }
  }
}
