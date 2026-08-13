import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Redis integration hook.
 *
 * Phase 2 wires the client and the typed helpers below (used by presence
 * caching, pub/sub between Socket.IO adapters in a multi-instance
 * deployment, and short-lived caches) but does not require a live Redis
 * instance to boot the app — connection is lazy and failures are logged
 * rather than crashing the process, since Phase 2 ships "hooks only" per
 * the project brief. Point REDIS_URL at a real instance to activate it.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit() {
    this.client = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    this.client.on('error', (err) => {
      this.logger.warn(
        `Redis unavailable (${err.message}) — continuing without cache`,
      );
    });

    this.client.connect().catch(() => {
      this.logger.warn(
        'Redis connection skipped — no instance reachable at REDIS_URL',
      );
    });
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }

  get isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  async setPresence(
    userId: string,
    status: string,
    ttlSeconds = 120,
  ): Promise<void> {
    if (!this.isConnected) return;
    await this.client!.set(`presence:${userId}`, status, 'EX', ttlSeconds);
  }

  async getPresence(userId: string): Promise<string | null> {
    if (!this.isConnected) return null;
    return this.client!.get(`presence:${userId}`);
  }

  async cacheSet(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.isConnected) return;
    await this.client!.set(key, value, 'EX', ttlSeconds);
  }

  async cacheGet(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    return this.client!.get(key);
  }

  async cacheDelete(key: string): Promise<void> {
    if (!this.isConnected) return;
    await this.client!.del(key);
  }

  // --- Structured cache helpers -------------------------------------------
  // Key naming and TTLs are documented in docs/database/redis-strategy.md.
  // Callers should treat a cache miss (including "Redis unavailable") as
  // the normal path — always fall back to Postgres, never treat Redis as
  // the source of truth.

  cacheUser(userId: string, json: string): Promise<void> {
    return this.cacheSet(`cache:user:${userId}`, json, 300); // 5 min
  }

  getCachedUser(userId: string): Promise<string | null> {
    return this.cacheGet(`cache:user:${userId}`);
  }

  invalidateUser(userId: string): Promise<void> {
    return this.cacheDelete(`cache:user:${userId}`);
  }

  cacheCommunity(communityId: string, json: string): Promise<void> {
    return this.cacheSet(`cache:community:${communityId}`, json, 300); // 5 min
  }

  getCachedCommunity(communityId: string): Promise<string | null> {
    return this.cacheGet(`cache:community:${communityId}`);
  }

  invalidateCommunity(communityId: string): Promise<void> {
    return this.cacheDelete(`cache:community:${communityId}`);
  }

  /**
   * Fixed-window rate limiter: `rate-limit:{identifier}` is INCRemented
   * (atomic in Redis) and given a TTL only on its first increment in the
   * window, so the window resets `windowSeconds` after the first hit.
   * Fails open (returns "allowed") when Redis is unavailable, consistent
   * with Redis never being allowed to become a hard dependency for
   * requests to succeed — see docs/database/redis-strategy.md.
   */
  async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    if (!this.isConnected) return { allowed: true, remaining: limit };
    const key = `rate-limit:${identifier}`;
    const count = await this.client!.incr(key);
    if (count === 1) {
      await this.client!.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.isConnected) return;
    await this.client!.publish(channel, message);
  }
}
