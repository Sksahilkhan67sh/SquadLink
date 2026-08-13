import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'shadowstrike' })
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Handle may only contain letters, numbers, and underscores',
  })
  handle!: string;

  @ApiProperty({ example: 'Ava Chen' })
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  displayName!: string;

  @ApiProperty({ example: 'ava@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'a-strong-password-1', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
