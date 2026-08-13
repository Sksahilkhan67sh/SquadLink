import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { VoiceRepository } from './voice.repository';

@Module({
  controllers: [VoiceController],
  providers: [VoiceService, VoiceRepository],
  exports: [VoiceService],
})
export class VoiceModule {}
