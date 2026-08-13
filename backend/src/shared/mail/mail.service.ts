import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: AppConfigService) {
    const { host, port, user, password } = this.config.mail;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.mail.from,
        to,
        subject,
        html,
      });
    } catch (err) {
      // Non-fatal: in local/dev without a configured SMTP server we log the
      // email instead of blocking the request that triggered it.
      this.logger.warn(
        `Could not deliver email to ${to} ("${subject}") - ${(err as Error).message}. Falling back to log output.`,
      );
      this.logger.log(`[mail:${to}] ${subject}\n${html}`);
    }
  }

  async sendVerificationEmail(
    to: string,
    displayName: string,
    verifyUrl: string,
  ): Promise<void> {
    await this.send(
      to,
      'Verify your SquadLink email',
      `<p>Hey ${displayName},</p><p>Confirm your email to finish setting up SquadLink:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    displayName: string,
    resetUrl: string,
  ): Promise<void> {
    await this.send(
      to,
      'Reset your SquadLink password',
      `<p>Hey ${displayName},</p><p>Use the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email. This link expires in 1 hour.</p>`,
    );
  }
}
