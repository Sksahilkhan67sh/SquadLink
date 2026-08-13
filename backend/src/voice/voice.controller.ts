import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { VoiceService } from './voice.service';
import { ReconnectVoiceDto } from './dto/voice.dto';

@ApiTags('voice')
@ApiBearerAuth()
@Controller({ path: 'voice', version: '1' })
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('channels/:channelId/join')
  @ApiOperation({
    summary: 'Join a community voice channel — returns a LiveKit token',
  })
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('channelId') channelId: string,
  ) {
    return this.voiceService.joinChannel(user.id, channelId, user.handle);
  }

  @Post('reconnect')
  @ApiOperation({
    summary:
      'Reissue a token for an existing voice room after a dropped connection',
  })
  reconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReconnectVoiceDto,
  ) {
    return this.voiceService.reconnect(user.id, user.handle, dto.roomName);
  }
}
