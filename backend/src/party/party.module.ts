import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FriendsModule } from '../friends/friends.module';
import { PartyController } from './party.controller';
import { PartyService } from './party.service';
import { PartyRepository } from './party.repository';

@Module({
  imports: [NotificationsModule, FriendsModule],
  controllers: [PartyController],
  providers: [PartyService, PartyRepository],
  exports: [PartyService, PartyRepository],
})
export class PartyModule {}
