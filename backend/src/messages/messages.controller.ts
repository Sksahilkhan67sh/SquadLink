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
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { MessagesService } from './messages.service';
import {
  CreateDmDto,
  CreateGroupDto,
  EditMessageDto,
  ReactionDto,
  SendMessageDto,
} from './dto/message.dto';

@ApiTags('messages')
@ApiBearerAuth()
@Controller({ path: 'conversations', version: '1' })
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'List all conversations for the current user' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.messagesService.listConversations(user.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search messages across all conversations' })
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') query: string) {
    return this.messagesService.search(user.id, query ?? '');
  }

  @Post('dm')
  @ApiOperation({ summary: 'Get or create a direct message conversation' })
  createDm(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDmDto) {
    return this.messagesService.getOrCreateDm(user.id, dto.userId);
  }

  @Post('group')
  @ApiOperation({ summary: 'Create a group conversation' })
  createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
  ) {
    return this.messagesService.createGroup(user.id, dto.name, dto.memberIds);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages in a conversation, paginated' })
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.messagesService.listMessages(
      user.id,
      id,
      query.page,
      query.limit,
    );
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      user.id,
      id,
      dto.content,
      dto.replyToId,
      dto.attachments,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a conversation as read' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.messagesService.markRead(user.id, id);
  }

  @Patch(':id/mute')
  @ApiOperation({ summary: 'Mute a conversation' })
  mute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.messagesService.setMuted(user.id, id, true);
  }

  @Patch(':id/unmute')
  @ApiOperation({ summary: 'Unmute a conversation' })
  unmute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.messagesService.setMuted(user.id, id, false);
  }

  @Patch('messages/:messageId')
  @ApiOperation({ summary: 'Edit a message' })
  editMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(user.id, messageId, dto.content);
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message' })
  deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessage(user.id, messageId);
  }

  @Patch(':id/messages/:messageId/pin')
  @ApiOperation({ summary: 'Pin a message' })
  pin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.pinMessage(user.id, id, messageId, true);
  }

  @Patch(':id/messages/:messageId/unpin')
  @ApiOperation({ summary: 'Unpin a message' })
  unpin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.pinMessage(user.id, id, messageId, false);
  }

  @Post('messages/:messageId/reactions')
  @ApiOperation({ summary: 'React to a message' })
  react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
    @Body() dto: ReactionDto,
  ) {
    return this.messagesService.react(user.id, messageId, dto.emoji);
  }

  @Delete('messages/:messageId/reactions/:emoji')
  @ApiOperation({ summary: 'Remove a reaction from a message' })
  unreact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
  ) {
    return this.messagesService.unreact(
      user.id,
      messageId,
      decodeURIComponent(emoji),
    );
  }
}
