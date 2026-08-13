declare module 'passport-discord' {
  import { Request } from 'express';
  import { Strategy as PassportStrategy } from 'passport-strategy';

  export interface Profile {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    email?: string;
    verified?: boolean;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    passReqToCallback?: boolean;
  }

  export type VerifyCallback = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: unknown, user?: unknown) => void,
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyCallback);
    authenticate(req: Request, options?: object): void;
  }
}

declare module 'passport-steam' {
  import { Strategy as PassportStrategy } from 'passport-strategy';

  export interface Profile {
    id: string;
    displayName: string;
    photos?: { value: string }[];
    _json?: {
      steamid: string;
      personaname: string;
      avatarfull: string;
      profileurl: string;
    };
  }

  export interface StrategyOptions {
    returnURL: string;
    realm: string;
    apiKey: string;
  }

  export type VerifyCallback = (
    identifier: string,
    profile: Profile,
    done: (error: unknown, user?: unknown) => void,
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyCallback);
  }
}
