import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from '../auth.service';
import { OAuthProvider } from '@prisma/client';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: AppConfigService,
    private readonly authService: AuthService,
  ) {
    const { clientId, clientSecret, callbackUrl } = config.oauth.google;
    super({
      clientID: clientId || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL:
        callbackUrl || `${config.apiUrl}/api/v1/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value;
      const user = await this.authService.loginOrCreateWithOAuth({
        provider: OAuthProvider.GOOGLE,
        providerUserId: profile.id,
        email: email ?? `${profile.id}@google.squadlink.local`,
        displayName: profile.displayName || 'SquadLink Player',
        avatarUrl: profile.photos?.[0]?.value,
      });
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
