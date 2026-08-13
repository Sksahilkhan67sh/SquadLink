import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty({
    description: 'Handle of the user to send a request to',
    example: 'shadowstrike',
  })
  @IsString()
  @MinLength(3)
  handle!: string;
}
