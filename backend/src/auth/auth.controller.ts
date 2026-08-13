import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { User } from '@prisma/client';

import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { AppConfigService } from '../config/app-config.service';

import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/auth-response.dto';
import {
  ForgotPasswordDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password-reset.dto';

import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { TwitchAuthGuard } from './guards/twitch-auth.guard';
import { SteamAuthGuard } from './guards/steam-auth.guard';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokensService: TokensService,
    private readonly config: AppConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: this.config.isProduction ? 'none' : 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private deviceContext(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }

  // -----------------------------------------------------------------------
  // Email + Password Authentication
  // -----------------------------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create a new account with email + password' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      dto,
      this.deviceContext(req),
    );

    this.setRefreshCookie(res, result.tokens.refreshToken);

    return result;
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email + password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      this.deviceContext(req),
    );

    this.setRefreshCookie(res, result.tokens.refreshToken);

    return result;
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access/refresh token pair',
  })
  @ApiBody({ type: RefreshTokenDto, required: false })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (
      req as unknown as {
        user: {
          refreshToken: string;
        };
      }
    ).user.refreshToken;

    const result = await this.authService.refreshTokens(
      refreshToken,
      this.deviceContext(req),
    );

    this.setRefreshCookie(res, result.tokens.refreshToken);

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log out and revoke the current refresh token',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as
      | string
      | undefined;

    await this.authService.logout(refreshToken, user.id);

    res.clearCookie(REFRESH_COOKIE, {
      path: '/api/v1/auth',
      secure: this.config.isProduction,
      sameSite: this.config.isProduction ? 'none' : 'lax',
    });
  }

  // -----------------------------------------------------------------------
  // Password Reset + Email Verification
  // -----------------------------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset password using the emailed token',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 300_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Verify an email address using the emailed token',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Resend the verification email',
  })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerificationEmail(dto.email);
  }

  // -----------------------------------------------------------------------
  // Session Management
  // -----------------------------------------------------------------------

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List active device sessions for the current user',
  })
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke a specific device session',
  })
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.authService.revokeSession(user.id, id);
  }

  // -----------------------------------------------------------------------
  // OAuth — Google, Discord, Twitch, GitHub, Steam
  // -----------------------------------------------------------------------

  private async completeOAuthLogin(
    req: Request,
    res: Response,
  ) {
    const user = req.user as User;

    const authResult = await this.authService.issueTokensForUser(
      user,
      this.deviceContext(req),
    );

    this.setRefreshCookie(
      res,
      authResult.tokens.refreshToken,
    );

    // The refresh token is intentionally NOT included here:
    // it's already set as an httpOnly cookie above.
    //
    // Putting a long-lived refresh token in a URL fragment would
    // expose it to browser history, extensions/scripts reading
    // location.hash, frontend logging, etc.
    //
    // Unlike the short-lived access token, that risk isn't worth taking.

    res.redirect(
      `${this.config.appUrl}/oauth/callback#accessToken=${authResult.tokens.accessToken}`,
    );
  }

  // -----------------------------------------------------------------------
  // Google OAuth
  // -----------------------------------------------------------------------

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({
    summary: 'Start Google OAuth flow',
  })
  googleAuth() {
    // Redirect handled by passport-google-oauth20
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback',
  })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.completeOAuthLogin(req, res);
  }

  // -----------------------------------------------------------------------
  // Discord OAuth
  // -----------------------------------------------------------------------

  @Public()
  @UseGuards(DiscordAuthGuard)
  @Get('discord')
  @ApiOperation({
    summary: 'Start Discord OAuth flow',
  })
  discordAuth() {}

  @Public()
  @UseGuards(DiscordAuthGuard)
  @Get('discord/callback')
  @ApiOperation({
    summary: 'Discord OAuth callback',
  })
  async discordCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.completeOAuthLogin(req, res);
  }

  // -----------------------------------------------------------------------
  // GitHub OAuth
  // -----------------------------------------------------------------------

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('github')
  @ApiOperation({
    summary: 'Start GitHub OAuth flow',
  })
  githubAuth() {}

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('github/callback')
  @ApiOperation({
    summary: 'GitHub OAuth callback',
  })
  async githubCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.completeOAuthLogin(req, res);
  }

  // -----------------------------------------------------------------------
  // Twitch OAuth
  // -----------------------------------------------------------------------

  @Public()
  @UseGuards(TwitchAuthGuard)
  @Get('twitch')
  @ApiOperation({
    summary: 'Start Twitch OAuth flow',
  })
  twitchAuth() {}

  @Public()
  @UseGuards(TwitchAuthGuard)
  @Get('twitch/callback')
  @ApiOperation({
    summary: 'Twitch OAuth callback',
  })
  async twitchCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.completeOAuthLogin(req, res);
  }

  // -----------------------------------------------------------------------
  // Steam OAuth
  // -----------------------------------------------------------------------

  @Public()
  @UseGuards(SteamAuthGuard)
  @Get('steam')
  @ApiOperation({
    summary: 'Start Steam OpenID flow',
  })
  steamAuth() {}

  @Public()
  @UseGuards(SteamAuthGuard)
  @Get('steam/callback')
  @ApiOperation({
    summary: 'Steam OpenID callback',
  })
  async steamCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.completeOAuthLogin(req, res);
  }
}
