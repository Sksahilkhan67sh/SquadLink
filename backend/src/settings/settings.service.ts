import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { UpdatePreferencesDto } from '../users/dto/update-user.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  getPreferences(userId: string) {
    return this.usersService.getPreferences(userId);
  }

  updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(userId, dto);
  }

  changePassword(userId: string, currentPassword: string, newPassword: string) {
    return this.authService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );
  }

  async deleteAccount(userId: string): Promise<void> {
    // Previously this did a raw `this.prisma.user.delete()` — which
    // throws a foreign-key error for anyone who owns a Community or
    // Party (those relations are onDelete: Restrict, deliberately, so a
    // deletion can't silently cascade into other members' data — see
    // the schema comments on Party.owner/Community.owner). It also
    // skipped revoking sessions and closing voice rooms. UsersService
    // already has the correct version — transaction-safe ownership
    // handoff, then a soft-delete/anonymize — used by DELETE /users/me;
    // delegating here means there's exactly one account-deletion path
    // instead of two that disagree.
    await this.usersService.deleteAccount(userId);
  }
}
