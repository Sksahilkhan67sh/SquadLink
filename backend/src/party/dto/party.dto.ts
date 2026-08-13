import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePartyDto {
  @ApiProperty({ example: "Roshan's Party" })
  @IsString()
  @MinLength(1)
  @MaxLength(48)
  name!: string;

  @ApiPropertyOptional({ example: 'Valorant' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  game?: string;

  @ApiPropertyOptional({ default: 5, minimum: 2, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10)
  maxSize?: number;
}

export class InviteToPartyDto {
  @ApiProperty()
  @IsString()
  userId!: string;
}

export class UpdatePartySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openInvites?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  regionLocked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;
}
