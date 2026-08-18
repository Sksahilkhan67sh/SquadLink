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
 * Wires the client and the one helper actually in use (presence TTLs,
 * below) without requiring a live Redis instance to boot the app —
 * connection is lazy and failures are logged rather than crashing the
 * process. Point REDIS_URL at a real instance to activate it.
 *
 * This previously also carried a set of structured cache helpers
 * (cacheUser/cacheCommunity/checkRateLimit/publish) that were fully
 * written but never called from anywhere in the codebase — dead code
 * that made it look like caching and rate-limiting were active when they
 * weren't. They've been removed rather than wired in: doing that
 * properly means adding correct invalidation on every write path for
 * each cached entity, which needs a live Redis+Postgres to verify isn't
 * serving stale data, and that verification hasn't been possible in this
 * environment. Re-add them deliberately, with invalidation, when that's
 * available — see docs/database/redis-strategy.md for the intended
 * design.
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
}
