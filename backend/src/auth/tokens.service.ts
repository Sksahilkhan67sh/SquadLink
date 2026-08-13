import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AppConfigService } from '../config/app-config.service';

export interface JwtPayload {
  sub: string;
  email: string;
  handle: string;
}

const REFRESH_HASH_ROUNDS = 10;

@Injectable()
export class TokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  signAccessToken(payload: JwtPayload): { token: string; expiresIn: number } {
    const { accessSecret, accessExpiresIn } = this.config.jwt;
    const token = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });
    return { token, expiresIn: this.expiresInSeconds(accessExpiresIn) };
  }

  signRefreshToken(payload: JwtPayload): string {
    const { refreshSecret, refreshExpiresIn } = this.config.jwt;
    return this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.config.jwt.refreshSecret,
    });
  }

  /** Hashes a refresh token before it's stored in the Session table. */
  async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, REFRESH_HASH_ROUNDS);
  }

  async compareRefreshToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  /** Opaque, URL-safe token for email verification / password reset links. */
  generateOpaqueToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashOpaqueToken(raw) };
  }

  hashOpaqueToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private expiresInSeconds(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = match[2];
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
    return value * multiplier;
  }
}
