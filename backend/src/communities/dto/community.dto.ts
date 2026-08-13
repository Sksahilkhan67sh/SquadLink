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
