import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { UpdatePreferencesDto } from '../users/dto/update-user.dto';
import { SettingsService } from './settings.service';
import { ChangePasswordDto } from './dto/settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('preferences')
  @ApiOperation({
    summary: 'Get appearance/audio/notification/privacy preferences',
  })
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({
    summary: 'Update appearance/audio/notification/privacy preferences',
  })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.settingsService.updatePreferences(user.id, dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change account password' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.settingsService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete the current account' })
  deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.deleteAccount(user.id);
  }
}
