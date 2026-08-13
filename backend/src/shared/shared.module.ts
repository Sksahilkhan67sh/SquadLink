import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis/redis.service';
import { MailService } from './mail/mail.service';
import { LiveKitService } from './livekit/livekit.service';
import { StorageModule } from './storage/storage.module';

@Global()
@Module({
  imports: [StorageModule],
  providers: [RedisService, MailService, LiveKitService],
  exports: [RedisService, MailService, LiveKitService, StorageModule],
})
export class SharedModule {}
