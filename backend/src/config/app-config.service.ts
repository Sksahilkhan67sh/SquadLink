import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvConfig } from './env.validation';

/**
 * Thin typed wrapper around Nest's ConfigService so the rest of the app
 * never has to deal with untyped `.get('SOME_KEY')` calls or string keys.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: NestConfigService<EnvConfig, true>) {}

  get isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  get port(): number {
    return this.config.get('PORT');
  }

  get apiPrefix(): string {
    return this.config.get('API_PREFIX');
  }

  get corsOrigin(): string {
    return this.config.get('CORS_ORIGIN');
  }

  get appUrl(): string {
    return this.config.get('APP_URL');
  }

  get apiUrl(): string {
    return this.config.get('API_URL');
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.config.get('REDIS_URL');
  }

  get jwt() {
    return {
      accessSecret: this.config.get('JWT_ACCESS_SECRET'),
      accessExpiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN'),
      refreshSecret: this.config.get('JWT_REFRESH_SECRET'),
      refreshExpiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
    };
  }

  get mail() {
    return {
      host: this.config.get('MAIL_HOST'),
      port: this.config.get('MAIL_PORT'),
      user: this.config.get('MAIL_USER'),
      password: this.config.get('MAIL_PASSWORD'),
      from: this.config.get('MAIL_FROM'),
    };
  }

  get oauth() {
    return {
      google: {
        clientId: this.config.get('GOOGLE_CLIENT_ID'),
        clientSecret: this.config.get('GOOGLE_CLIENT_SECRET'),
        callbackUrl: this.config.get('GOOGLE_CALLBACK_URL'),
      },
      discord: {
        clientId: this.config.get('DISCORD_CLIENT_ID'),
        clientSecret: this.config.get('DISCORD_CLIENT_SECRET'),
        callbackUrl: this.config.get('DISCORD_CALLBACK_URL'),
      },
      twitch: {
        clientId: this.config.get('TWITCH_CLIENT_ID'),
        clientSecret: this.config.get('TWITCH_CLIENT_SECRET'),
        callbackUrl: this.config.get('TWITCH_CALLBACK_URL'),
      },
      github: {
        clientId: this.config.get('GITHUB_CLIENT_ID'),
        clientSecret: this.config.get('GITHUB_CLIENT_SECRET'),
        callbackUrl: this.config.get('GITHUB_CALLBACK_URL'),
      },
      steam: {
        apiKey: this.config.get('STEAM_API_KEY'),
        callbackUrl: this.config.get('STEAM_CALLBACK_URL'),
        realm: this.config.get('STEAM_REALM'),
      },
    };
  }

  get liveKit() {
    return {
      apiKey: this.config.get('LIVEKIT_API_KEY'),
      apiSecret: this.config.get('LIVEKIT_API_SECRET'),
      url: this.config.get('LIVEKIT_URL'),
    };
  }

  get upload() {
    return {
      driver: this.config.get('UPLOAD_DRIVER'),
      localDir: this.config.get('UPLOAD_LOCAL_DIR'),
      maxSizeMb: this.config.get('UPLOAD_MAX_SIZE_MB'),
      s3: {
        bucket: this.config.get('S3_BUCKET'),
        region: this.config.get('S3_REGION'),
        accessKeyId: this.config.get('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.get('S3_SECRET_ACCESS_KEY'),
        publicUrl: this.config.get('S3_PUBLIC_URL'),
      },
    };
  }

  get throttle() {
    return {
      ttlMs: this.config.get('THROTTLE_TTL_MS'),
      limit: this.config.get('THROTTLE_LIMIT'),
    };
  }
}
