import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/friend-request.dto';

@ApiTags('friends')
@ApiBearerAuth()
@Controller({ path: 'friends', version: '1' })
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'List all friends' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.listFriends(user.id);
  }

  @Get('requests/incoming')
  @ApiOperation({ summary: 'List incoming friend requests' })
  incoming(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.listIncoming(user.id);
  }

  @Get('requests/outgoing')
  @ApiOperation({ summary: 'List outgoing friend requests' })
  outgoing(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.listOutgoing(user.id);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Send a friend request by handle' })
  sendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendsService.sendRequest(user.id, dto.handle);
  }

  @Post('requests/:id/accept')
  @ApiOperation({ summary: 'Accept an incoming friend request' })
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.friendsService.acceptRequest(user.id, id);
  }

  @Post('requests/:id/decline')
  @ApiOperation({ summary: 'Decline an incoming friend request' })
  decline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.friendsService.declineRequest(user.id, id);
  }

  @Delete('requests/:id')
  @ApiOperation({ summary: 'Cancel an outgoing friend request' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.friendsService.cancelRequest(user.id, id);
  }

  @Put(':userId/pin')
  @ApiOperation({ summary: 'Pin a friend' })
  pin(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.friendsService.setPinned(user.id, userId, true);
  }

  @Delete(':userId/pin')
  @ApiOperation({ summary: 'Unpin a friend' })
  unpin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.friendsService.setPinned(user.id, userId, false);
  }

  @Get(':userId/mutual')
  @ApiOperation({ summary: 'Count mutual friends with another user' })
  async mutual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    const count = await this.friendsService.mutualFriends(user.id, userId);
    return { count };
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a friend' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.friendsService.removeFriend(user.id, userId);
  }

  @Post(':userId/block')
  @ApiOperation({ summary: 'Block a user' })
  block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.friendsService.blockUser(user.id, userId);
  }

  @Delete(':userId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unblock a user' })
  unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.friendsService.unblockUser(user.id, userId);
  }

  @Get('blocked')
  @ApiOperation({ summary: 'List blocked users' })
  listBlocked(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.listBlocked(user.id);
  }
}
