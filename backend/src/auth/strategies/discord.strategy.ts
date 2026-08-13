import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-discord';
import { OAuthProvider } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from '../auth.service';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(
    config: AppConfigService,
    private readonly authService: AuthService,
  ) {
    const { clientId, clientSecret, callbackUrl } = config.oauth.discord;
    super({
      clientID: clientId || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL:
        callbackUrl || `${config.apiUrl}/api/v1/auth/discord/callback`,
      scope: ['identify', 'email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: unknown, user?: unknown) => void,
  ): Promise<void> {
    try {
      const avatarUrl = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : undefined;
      const user = await this.authService.loginOrCreateWithOAuth({
        provider: OAuthProvider.DISCORD,
        providerUserId: profile.id,
        email: profile.email ?? `${profile.id}@discord.squadlink.local`,
        displayName: profile.username || 'SquadLink Player',
        avatarUrl,
      });
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
