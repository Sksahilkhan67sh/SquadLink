import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    super({
      datasources: {
        db: { url: config.databaseUrl },
      },
      log: config.isProduction
        ? [{ emit: 'event', level: 'error' }]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
    });
  }

  async onModuleInit() {
    // Prisma's event typings are loose across log-level unions; the runtime
    // event names ('warn' | 'error') are correct for the config above.
    (
      this as unknown as {
        $on: (event: string, cb: (e: unknown) => void) => void;
      }
    ).$on('warn', (e) => this.logger.warn(e));
    (
      this as unknown as {
        $on: (event: string, cb: (e: unknown) => void) => void;
      }
    ).$on('error', (e) => this.logger.error(e));

    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs a callback inside a Prisma transaction. Thin wrapper kept here so
   * services depend on PrismaService rather than importing PrismaClient
   * transaction types directly everywhere.
   */
  async transaction<T>(
    fn: (
      tx: Omit<
        PrismaClient,
        | '$connect'
        | '$disconnect'
        | '$on'
        | '$transaction'
        | '$use'
        | '$extends'
      >,
    ) => Promise<T>,
  ): Promise<T> {
    return this.$transaction((tx) => fn(tx));
  }
}
