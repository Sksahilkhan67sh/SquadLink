import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { JwtPayload } from '../tokens.service';

export interface RefreshTokenPayload extends JwtPayload {
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies?.['refresh_token'] as string | undefined) ?? null,
        ExtractJwt.fromBodyField('refreshToken'),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwt.refreshSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): RefreshTokenPayload {
    const refreshToken =
      (req.cookies?.['refresh_token'] as string | undefined) ??
      (req.body as { refreshToken?: string } | undefined)?.refreshToken ??
      req.headers.authorization?.replace('Bearer ', '');

    // jwtFromRequest above already guarantees a token was present for
    // Passport to reach this point at all — this check only satisfies
    // strict-null-checks and guards the (practically unreachable) case
    // where the three extractors disagree with the one Passport used.
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing from request');
    }

    return { ...payload, refreshToken };
  }
}
