import { ApiPropertyOptional } from '@nestjs/swagger';
import { PresenceStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  handle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  avatarColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  bannerAccent?: string;
}

export class UpdatePresenceDto {
  @ApiPropertyOptional({ enum: PresenceStatus })
  @IsOptional()
  @IsEnum(PresenceStatus)
  status?: PresenceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  statusText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  currentGame?: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['orange', 'steel'])
  accentTheme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['comfortable', 'compact'])
  density?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  inputVolume?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  outputVolume?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noiseSuppression?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushToTalk?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyDirectMessage?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyPartyInvite?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyCommunity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifySound?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showActivityStatus?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['everyone', 'friends-of-friends', 'none'])
  allowFriendRequests?: string;

  // Overlay settings previously lived only in frontend component state
  // (OverlayPage.tsx) and were lost on every reload — these persist them
  // the same way every other preference here does.
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overlayEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
  overlayPosition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(100)
  overlayOpacity?: number;
}
