import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { UpdatePreferencesDto } from '../users/dto/update-user.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
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
    // Cascading deletes configured in the Prisma schema handle sessions,
    // memberships, messages authored, etc.
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
