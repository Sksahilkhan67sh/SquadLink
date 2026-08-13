import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-steam';
import { OAuthProvider } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from '../auth.service';

/**
 * Steam does not offer OAuth2 -- authentication is done via OpenID 2.0,
 * after which the Steam Web API is used to fetch the player's public
 * profile. `passport-steam` handles the OpenID handshake; we just need a
 * valid STEAM_API_KEY to resolve the profile.
 */
@Injectable()
export class SteamStrategy extends PassportStrategy(Strategy, 'steam') {
  constructor(
    config: AppConfigService,
    private readonly authService: AuthService,
  ) {
    const { apiKey, callbackUrl, realm } = config.oauth.steam;
    super({
      returnURL: callbackUrl || `${config.apiUrl}/api/v1/auth/steam/callback`,
      realm: realm || config.apiUrl,
      apiKey: apiKey || 'not-configured',
    });
  }

  async validate(
    _identifier: string,
    profile: Profile,
    done: (error: unknown, user?: unknown) => void,
  ): Promise<void> {
    try {
      const steamId = profile._json?.steamid ?? profile.id;
      const user = await this.authService.loginOrCreateWithOAuth({
        provider: OAuthProvider.STEAM,
        providerUserId: steamId,
        email: `${steamId}@steam.squadlink.local`,
        displayName:
          profile._json?.personaname ||
          profile.displayName ||
          'SquadLink Player',
        avatarUrl: profile._json?.avatarfull || profile.photos?.[0]?.value,
      });
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
