import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MessageAttachmentDto {
  @ApiProperty({ enum: ['IMAGE', 'FILE'] })
  @IsIn(['IMAGE', 'FILE'])
  type!: 'IMAGE' | 'FILE';

  @ApiProperty()
  @IsString()
  url!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  size?: number;
}

export class CreateDmDto {
  @ApiProperty({ description: 'User ID to start a direct message with' })
  @IsString()
  userId!: string;
}

export class CreateGroupDto {
  @ApiProperty({ example: 'Ranked Squad' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({
    type: [String],
    description: 'User IDs to include besides yourself',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds!: string[];
}

export class SendMessageDto {
  @ApiProperty({ example: 'gg that was close' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @ApiPropertyOptional({ description: 'ID of the message being replied to' })
  @IsOptional()
  @IsString()
  replyToId?: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}

export class EditMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}

export class ReactionDto {
  @ApiProperty({ example: '🔥' })
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  emoji!: string;
}
