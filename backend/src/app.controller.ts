import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './database/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness: is the process itself running and able to respond at all.
   * Deliberately does NOT touch the database — a slow/unreachable DB
   * should surface as a readiness failure, not cause an orchestrator to
   * kill and restart an otherwise-healthy process.
   */
  @Public()
  @Get('live')
  @ApiExcludeEndpoint()
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness: can this instance actually serve traffic right now. Used
   * by the Docker HEALTHCHECK / load balancer / k8s readiness probe.
   * Returns a real 503 (not 200 with a "database: unreachable" string
   * buried in the body) when a dependency is down, so probes relying on
   * HTTP status actually catch it.
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
