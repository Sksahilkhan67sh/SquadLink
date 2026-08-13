import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { OAuthProvider } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from '../auth.service';

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  email?: string;
  profile_image_url?: string;
}

/**
 * Twitch OAuth strategy built on the generic `passport-oauth2` package.
 * There is no actively maintained, typed `passport-twitch` package, so we
 * implement the standard OAuth2 authorization-code flow directly against
 * Twitch's endpoints and fetch the profile from the Helix `/users` API
 * ourselves -- the same approach Twitch's own developer docs recommend for
 * non-officially-supported OAuth libraries.
 */
@Injectable()
export class TwitchStrategy extends PassportStrategy(OAuth2Strategy, 'twitch') {
  constructor(
    private readonly config: AppConfigService,
    private readonly authService: AuthService,
  ) {
    const { clientId, clientSecret, callbackUrl } = config.oauth.twitch;
    super({
      authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
      tokenURL: 'https://id.twitch.tv/oauth2/token',
      clientID: clientId || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL:
        callbackUrl || `${config.apiUrl}/api/v1/auth/twitch/callback`,
      scope: ['user:read:email'],
      state: true,
    });
  }

  userProfile(
    accessToken: string,
    done: (err: unknown, profile?: unknown) => void,
  ): void {
    void this.fetchProfile(accessToken, done);
  }

  private async fetchProfile(
    accessToken: string,
    done: (err: unknown, profile?: unknown) => void,
  ): Promise<void> {
    try {
      const response = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.config.oauth.twitch.clientId ?? '',
        },
      });
      if (!response.ok) {
        throw new Error(
          `Twitch profile request failed with status ${response.status}`,
        );
      }
      const json = (await response.json()) as { data: TwitchUser[] };
      done(null, json.data[0]);
    } catch (err) {
      done(err as Error);
    }
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: TwitchUser,
    done: (error: unknown, user?: unknown) => void,
  ): Promise<void> {
    try {
      const user = await this.authService.loginOrCreateWithOAuth({
        provider: OAuthProvider.TWITCH,
        providerUserId: profile.id,
        email: profile.email ?? `${profile.id}@twitch.squadlink.local`,
        displayName:
          profile.display_name || profile.login || 'SquadLink Player',
        avatarUrl: profile.profile_image_url,
      });
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
