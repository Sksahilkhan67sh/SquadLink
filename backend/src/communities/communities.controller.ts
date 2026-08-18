import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { CommunitiesService } from './communities.service';
import {
  CreateAnnouncementDto,
  CreateChannelDto,
  CreateChannelGroupDto,
  CreateCommunityDto,
  CreateEventDto,
  CreateRoleDto,
  SendChannelMessageDto,
  UpdateCommunityDto,
} from './dto/community.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('communities')
@ApiBearerAuth()
@Controller({ path: 'communities', version: '1' })
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List communities the current user has joined' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.communitiesService.listForUser(user.id);
  }

  @Get('browse')
  @ApiOperation({ summary: 'Browse/search public communities' })
  browse(@Query('q') query?: string) {
    return this.communitiesService.browse(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new community' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityDto,
  ) {
    return this.communitiesService.create(user.id, dto.name, dto.tag);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get community details (channels, roles)' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communitiesService.getByIdForMember(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update community settings' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communitiesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a community (owner only)' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communitiesService.delete(user.id, id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a community' })
  join(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communitiesService.join(user.id, id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a community' })
  leave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communitiesService.leave(user.id, id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List community members' })
  listMembers(@Param('id') id: string) {
    return this.communitiesService.listMembers(id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Kick a member' })
  kickMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.communitiesService.kickMember(user.id, id, userId);
  }

  @Post(':id/channel-groups')
  @ApiOperation({ summary: 'Create a channel group' })
  createChannelGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateChannelGroupDto,
  ) {
    return this.communitiesService.createChannelGroup(
      user.id,
      id,
      dto.name,
      dto.position,
    );
  }

  @Post(':id/channel-groups/:groupId/channels')
  @ApiOperation({ summary: 'Create a channel within a channel group' })
  createChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.communitiesService.createChannel(
      user.id,
      id,
      groupId,
      dto.name,
      dto.type,
      dto.position,
    );
  }

  @Delete(':id/channels/:channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a channel' })
  deleteChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('channelId') channelId: string,
  ) {
    return this.communitiesService.deleteChannel(user.id, id, channelId);
  }

  @Get(':id/channels/:channelId/messages')
  @ApiOperation({ summary: 'List messages in a text channel, paginated' })
  listChannelMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('channelId') channelId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.communitiesService.listChannelMessages(
      user.id,
      id,
      channelId,
      query.page,
      query.limit,
    );
  }

  @Post(':id/channels/:channelId/messages')
  @ApiOperation({ summary: 'Send a message in a text channel' })
  sendChannelMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('channelId') channelId: string,
    @Body() dto: SendChannelMessageDto,
  ) {
    return this.communitiesService.sendChannelMessage(
      user.id,
      id,
      channelId,
      dto.content,
    );
  }

  @Post(':id/roles')
  @ApiOperation({ summary: 'Create a role' })
  createRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.communitiesService.createRole(
      user.id,
      id,
      dto.name,
      dto.color,
      dto.permissions,
      dto.position,
    );
  }

  @Delete(':id/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role' })
  deleteRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.communitiesService.deleteRole(user.id, id, roleId);
  }

  @Post(':id/members/:userId/roles/:roleId')
  @ApiOperation({ summary: 'Assign a role to a member' })
  assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.communitiesService.assignRole(user.id, id, userId, roleId);
  }

  @Delete(':id/members/:userId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a role from a member' })
  unassignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.communitiesService.unassignRole(user.id, id, userId, roleId);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List community events' })
  listEvents(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communitiesService.listEvents(user.id, id);
  }

  @Post(':id/events')
  @ApiOperation({ summary: 'Create a community event' })
  createEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.communitiesService.createEvent(
      user.id,
      id,
      dto.title,
      dto.date,
      dto.game,
    );
  }

  @Get(':id/announcements')
  @ApiOperation({ summary: 'List community announcements' })
  listAnnouncements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.communitiesService.listAnnouncements(user.id, id);
  }

  @Post(':id/announcements')
  @ApiOperation({ summary: 'Post a community announcement' })
  createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.communitiesService.createAnnouncement(
      user.id,
      id,
      dto.title,
      dto.body,
    );
  }
}
