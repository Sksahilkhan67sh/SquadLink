import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { OAuthProvider } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    config: AppConfigService,
    private readonly authService: AuthService,
  ) {
    const { clientId, clientSecret, callbackUrl } = config.oauth.github;
    super({
      clientID: clientId || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL:
        callbackUrl || `${config.apiUrl}/api/v1/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: unknown, user?: unknown) => void,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value;
      const user = await this.authService.loginOrCreateWithOAuth({
        provider: OAuthProvider.GITHUB,
        providerUserId: profile.id,
        email: email ?? `${profile.id}@github.squadlink.local`,
        displayName:
          profile.displayName || profile.username || 'SquadLink Player',
        avatarUrl: profile.photos?.[0]?.value,
      });
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
