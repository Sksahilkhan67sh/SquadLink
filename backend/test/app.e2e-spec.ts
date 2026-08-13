import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * End-to-end smoke test. Requires a reachable Postgres instance at
 * DATABASE_URL (e.g. `docker-compose up postgres -d`) since AppModule
 * connects Prisma on init — the health endpoint itself tolerates a
 * database that is down and reports it in the response body rather than
 * failing the request, so this test still passes either way.
 */
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  it('/api/v1/health (GET) reports app status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toMatchObject({ status: 'ok' });
    expect(['connected', 'unreachable']).toContain(response.body.database);
  });

  it('/api/v1/users/me (GET) requires authentication', () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
