import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OAuthProvider, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../shared/mail/mail.service';
import { AppConfigService } from '../config/app-config.service';
import { TokensService } from './tokens.service';
import {
  ConflictException,
  InvalidCredentialsException,
  ResourceNotFoundException,
  TokenExpiredException,
} from '../common/exceptions/app.exceptions';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

const PASSWORD_HASH_ROUNDS = 12;
const VERIFICATION_TOKEN_TTL_HOURS = 24;
const RESET_TOKEN_TTL_MINUTES = 60;

export interface DeviceContext {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly tokensService: TokensService,
    private readonly mailService: MailService,
    private readonly config: AppConfigService,
  ) {}

  // ---------------------------------------------------------------------
  // Register / login
  // ---------------------------------------------------------------------

  async register(
    dto: RegisterDto,
    device: DeviceContext,
    rememberMe = false,
  ): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    const user = await this.usersService.createLocalUser({
      email: dto.email,
      handle: dto.handle,
      displayName: dto.displayName,
      passwordHash,
    });

    await this.sendVerificationEmail(user);

    return this.issueAuthResponse(user, device, rememberMe);
  }

  async login(dto: LoginDto, device: DeviceContext): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsException();
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new InvalidCredentialsException();
    }

    return this.issueAuthResponse(user, device, dto.rememberMe ?? false);
  }

  async loginOrCreateWithOAuth(params: {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<User> {
    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: params.provider,
          providerUserId: params.providerUserId,
        },
      },
      include: { user: true },
    });
    if (existingAccount) return existingAccount.user;

    const existingUser = await this.usersService.findByEmail(params.email);
    if (existingUser) {
      await this.prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: params.provider,
          providerUserId: params.providerUserId,
        },
      });
      return existingUser;
    }

    const handleBase =
      params.displayName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20) || 'player';
    const user = await this.usersService.createOAuthUser({
      email: params.email,
      handle: handleBase,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl,
    });

    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: params.provider,
        providerUserId: params.providerUserId,
      },
    });

    return user;
  }

  // ---------------------------------------------------------------------
  // Tokens & sessions
  // ---------------------------------------------------------------------

  private async issueAuthResponse(
    user: User,
    device: DeviceContext,
    rememberMe: boolean,
  ): Promise<AuthResponseDto> {
    const payload = { sub: user.id, email: user.email, handle: user.handle };
    const access = this.tokensService.signAccessToken(payload);
    const refreshToken = this.tokensService.signRefreshToken(payload);
    const refreshTokenHash =
      await this.tokensService.hashRefreshToken(refreshToken);

    const ttlDays = rememberMe ? 30 : 7;
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        rememberMe,
        deviceName: device.deviceName,
        userAgent: device.userAgent,
        ipAddress: device.ipAddress,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
      tokens: {
        accessToken: access.token,
        refreshToken,
        expiresIn: access.expiresIn,
      },
    };
  }

  async issueTokensForUser(
    user: User,
    device: DeviceContext,
    rememberMe = true,
  ): Promise<AuthResponseDto> {
    return this.issueAuthResponse(user, device, rememberMe);
  }

  async refreshTokens(
    refreshToken: string,
    device: DeviceContext,
  ): Promise<AuthResponseDto> {
    let payload;
    try {
      payload = this.tokensService.verifyRefreshToken(refreshToken);
    } catch {
      throw new TokenExpiredException('Refresh token is invalid or expired');
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let matchedSession: (typeof sessions)[number] | undefined;
    for (const session of sessions) {
      const matches = await this.tokensService.compareRefreshToken(
        refreshToken,
        session.refreshTokenHash,
      );
      if (matches) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      throw new TokenExpiredException(
        'This session has been revoked. Please log in again.',
      );
    }

    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.usersService.findByIdOrThrow(payload.sub);
    return this.issueAuthResponse(user, device, matchedSession.rememberMe);
  }

  async logout(
    refreshToken: string | undefined,
    userId: string,
  ): Promise<void> {
    if (!refreshToken) {
      return;
    }
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
    });
    for (const session of sessions) {
      const matches = await this.tokensService.compareRefreshToken(
        refreshToken,
        session.refreshTokenHash,
      );
      if (matches) {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        userAgent: true,
        ipAddress: true,
        rememberMe: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new ResourceNotFoundException('Session', sessionId);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------
  // Email verification
  // ---------------------------------------------------------------------

  private async sendVerificationEmail(user: User): Promise<void> {
    const { raw, hash } = this.tokensService.generateOpaqueToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(
          Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
        ),
      },
    });
    const verifyUrl = `${this.config.appUrl}/verify-email?token=${raw}`;
    await this.mailService.sendVerificationEmail(
      user.email,
      user.displayName,
      verifyUrl,
    );
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerificationEmail(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const hash = this.tokensService.hashOpaqueToken(token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new TokenExpiredException(
        'This verification link is invalid or has expired',
      );
    }
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }

  // ---------------------------------------------------------------------
  // Password reset
  // ---------------------------------------------------------------------

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const { raw, hash } = this.tokensService.generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });
    const resetUrl = `${this.config.appUrl}/reset-password?token=${raw}`;
    await this.mailService.sendPasswordResetEmail(
      user.email,
      user.displayName,
      resetUrl,
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hash = this.tokensService.hashOpaqueToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new TokenExpiredException(
        'This reset link is invalid or has expired',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findByIdOrThrow(userId);
    if (!user.passwordHash) {
      throw new ConflictException(
        'This account signs in via a connected provider and has no password to change',
      );
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches)
      throw new InvalidCredentialsException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
