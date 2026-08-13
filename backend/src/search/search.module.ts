import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CommunitiesModule } from '../communities/communities.module';
import { MessagesModule } from '../messages/messages.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [UsersModule, CommunitiesModule, MessagesModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
