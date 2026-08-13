import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global search across users, communities, and messages',
  })
  searchAll(@CurrentUser() user: AuthenticatedUser, @Query('q') query: string) {
    return this.searchService.searchAll(user.id, query ?? '');
  }

  @Get('users')
  @ApiOperation({ summary: 'Search users' })
  searchUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query: string,
  ) {
    return this.searchService.searchUsers(user.id, query ?? '');
  }

  @Get('communities')
  @ApiOperation({ summary: 'Search communities' })
  searchCommunities(@Query('q') query: string) {
    return this.searchService.searchCommunities(query ?? '');
  }

  @Get('messages')
  @ApiOperation({ summary: 'Search messages' })
  searchMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query: string,
  ) {
    return this.searchService.searchMessages(user.id, query ?? '');
  }
}
