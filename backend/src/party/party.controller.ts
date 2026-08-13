import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { PartyService } from './party.service';
import {
  CreatePartyDto,
  InviteToPartyDto,
  UpdatePartySettingsDto,
} from './dto/party.dto';

@ApiTags('party')
@ApiBearerAuth()
@Controller({ path: 'party', version: '1' })
export class PartyController {
  constructor(private readonly partyService: PartyService) {}

  @Get('active')
  @ApiOperation({ summary: "Get the current user's active party, if any" })
  getActive(@CurrentUser() user: AuthenticatedUser) {
    return this.partyService.getActiveForUser(user.id);
  }

  @Get('invites/incoming')
  @ApiOperation({ summary: 'List pending party invites sent to the current user' })
  incomingInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.partyService.listIncomingInvites(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new party' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePartyDto) {
    return this.partyService.create(user.id, dto.name, dto.game, dto.maxSize);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get party details' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.partyService.getByIdForMember(user.id, id);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite a friend to the party' })
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InviteToPartyDto,
  ) {
    return this.partyService.invite(user.id, id, dto.userId);
  }

  @Post(':id/invite-friends')
  @ApiOperation({ summary: 'Invite every friend of the current user to the party ("public party")' })
  inviteFriends(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.partyService.inviteAllFriends(user.id, id);
  }

  @Post('invites/:inviteId/accept')
  @ApiOperation({ summary: 'Accept a party invite' })
  acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('inviteId') inviteId: string,
  ) {
    return this.partyService.respondToInvite(user.id, inviteId, true);
  }

  @Post('invites/:inviteId/decline')
  @ApiOperation({ summary: 'Decline a party invite' })
  declineInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('inviteId') inviteId: string,
  ) {
    return this.partyService.respondToInvite(user.id, inviteId, false);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave the party' })
  leave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.partyService.leave(user.id, id);
  }

  @Post(':id/kick/:userId')
  @ApiOperation({ summary: 'Kick a member (leader only)' })
  kick(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.partyService.kickMember(user.id, id, userId);
  }

  @Post(':id/transfer/:userId')
  @ApiOperation({ summary: 'Transfer party ownership (leader only)' })
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.partyService.transferOwnership(user.id, id, userId);
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Update party settings (leader only)' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePartySettingsDto,
  ) {
    return this.partyService.updateSettings(user.id, id, dto);
  }

  @Patch(':id/voice-state')
  @ApiOperation({ summary: 'Update your mute/deafen state in the party' })
  voiceState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { muted?: boolean; deafened?: boolean },
  ) {
    return this.partyService.setMemberVoiceState(user.id, id, dto);
  }

  @Get(':id/voice-token')
  @ApiOperation({
    summary: "Get a LiveKit access token for this party's voice room",
  })
  voiceToken(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.partyService.getVoiceGrant(user.id, id);
  }
}
