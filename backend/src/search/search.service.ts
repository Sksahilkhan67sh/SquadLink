import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CommunitiesService } from '../communities/communities.service';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly usersService: UsersService,
    private readonly communitiesService: CommunitiesService,
    private readonly messagesService: MessagesService,
  ) {}

  async searchAll(userId: string, query: string) {
    if (!query.trim()) {
      return { users: [], communities: [], messages: [] };
    }

    const [users, communities, messages] = await Promise.all([
      this.usersService.search(query, userId),
      this.communitiesService.browse(query, 10),
      this.messagesService.search(userId, query),
    ]);

    return { users, communities, messages };
  }

  searchUsers(userId: string, query: string) {
    return this.usersService.search(query, userId);
  }

  searchCommunities(query: string) {
    return this.communitiesService.browse(query, 20);
  }

  searchMessages(userId: string, query: string) {
    return this.messagesService.search(userId, query);
  }
}
