import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty({ example: 'Ascendant Collective' })
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  name!: string;

  @ApiProperty({ example: 'ASND' })
  @IsString()
  @MinLength(2)
  @MaxLength(6)
  tag!: string;
}

export class UpdateCommunityDto {
  @ApiPropertyOptional({ example: 'Ascendant Collective' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  name?: string;

  @ApiPropertyOptional({ example: 'ASND' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(6)
  tag?: string;

  // The service (CommunitiesService.update) has always accepted this, but
  // the controller previously typed the body as Partial<CreateCommunityDto>
  // — which doesn't declare accentColor — and main.ts's ValidationPipe runs
  // with forbidNonWhitelisted: true, so any request that actually included
  // accentColor was rejected outright with a 400. This DTO is what makes
  // the field reachable through the API at all.
  @ApiPropertyOptional({ example: '#f2691c' })
  @IsOptional()
  @IsHexColor()
  accentColor?: string;
}

export class CreateChannelGroupDto {
  @ApiProperty({ example: 'Voice' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  name!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateChannelDto {
  @ApiProperty({ example: 'general' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  name!: string;

  @ApiProperty({ enum: ChannelType })
  @IsEnum(ChannelType)
  type!: ChannelType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Moderator' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  name!: string;

  @ApiProperty({ example: '#5fb87a' })
  @IsHexColor()
  color!: string;

  @ApiProperty({ type: [String], example: ['MANAGE_MESSAGES', 'KICK_MEMBERS'] })
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  permissions!: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateEventDto {
  @ApiProperty({ example: 'Ranked Night — 5-stack scrims' })
  @IsString()
  @MinLength(1)
  @MaxLength(96)
  title!: string;

  @ApiProperty({ example: '2026-08-14T17:00:00Z' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: 'Valorant' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  game?: string;
}

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Season 3 kicks off Friday' })
  @IsString()
  @MinLength(1)
  @MaxLength(96)
  title!: string;

  @ApiProperty({ example: 'New ranked season, new rewards track...' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class SendChannelMessageDto {
  @ApiProperty({ example: 'anyone up for a scrim tonight?' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}
