import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ReconnectVoiceDto {
  @ApiProperty({
    description: 'The LiveKit room name from the original session',
  })
  @IsString()
  @MinLength(1)
  roomName!: string;
}
