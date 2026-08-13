import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { TokensService } from './tokens.service';
import { AppConfigService } from '../config/app-config.service';

describe('TokensService', () => {
  let service: TokensService;

  const mockConfig: Partial<AppConfigService> = {
    jwt: {
      accessSecret: 'test-access-secret-1234567890',
      accessExpiresIn: '15m',
      refreshSecret: 'test-refresh-secret-1234567890',
      refreshExpiresIn: '30d',
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        TokensService,
        { provide: AppConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = moduleRef.get(TokensService);
  });

  it('signs and verifies a refresh token round-trip', () => {
    const payload = { sub: 'user-1', email: 'a@b.com', handle: 'ava' };
    const token = service.signRefreshToken(payload);
    const decoded = service.verifyRefreshToken(token);

    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.handle).toBe(payload.handle);
  });

  it('rejects a refresh token signed with a different secret', () => {
    const payload = { sub: 'user-1', email: 'a@b.com', handle: 'ava' };
    const foreignToken = service.signAccessToken(payload).token; // signed with access secret
    expect(() => service.verifyRefreshToken(foreignToken)).toThrow();
  });

  it('produces a bcrypt hash that verifies only the original refresh token', async () => {
    const token = 'some-refresh-token-value';
    const hash = await service.hashRefreshToken(token);

    await expect(service.compareRefreshToken(token, hash)).resolves.toBe(true);
    await expect(
      service.compareRefreshToken('wrong-token', hash),
    ).resolves.toBe(false);
  });

  it('generates opaque tokens whose hash is deterministic but the raw value is not guessable from it', () => {
    const { raw, hash } = service.generateOpaqueToken();
    expect(raw).toHaveLength(43); // base64url of 32 random bytes
    expect(service.hashOpaqueToken(raw)).toBe(hash);
    expect(hash).not.toBe(raw);
  });

  it('computes expiresIn in seconds from a duration string', () => {
    const { expiresIn } = service.signAccessToken({
      sub: '1',
      email: 'a@b.com',
      handle: 'a',
    });
    expect(expiresIn).toBe(15 * 60);
  });
});
