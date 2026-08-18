import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { UsersService } from './users.service';
import {
  UpdatePresenceDto,
  UpdateProfileDto,
} from './dto/update-user.dto';
import { UserPrivateDto, UserPublicDto } from './dto/user-public.dto';
import { ResourceNotFoundException } from '../common/exceptions/app.exceptions';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: "Get the current user's full profile" })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserPrivateDto> {
    const entity = await this.usersService.findByIdOrThrow(user.id);
    return UserPrivateDto.fromEntityPrivate(entity);
  }

  @Patch('me')
  @ApiOperation({ summary: "Update the current user's profile" })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserPrivateDto> {
    const entity = await this.usersService.updateProfile(user.id, dto);
    return UserPrivateDto.fromEntityPrivate(entity);
  }

  @Patch('me/presence')
  @ApiOperation({ summary: 'Update presence status / current game' })
  async updatePresence(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePresenceDto,
  ): Promise<UserPrivateDto> {
    const entity = await this.usersService.updatePresence(user.id, dto);
    return UserPrivateDto.fromEntityPrivate(entity);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete (soft-delete/anonymize) the current account. Ownership of ' +
      'any owned communities/parties is transferred to another active ' +
      'member, or the community/party is removed if none exists.',
  })
  async deleteMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.usersService.deleteAccount(user.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by display name or handle' })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query: string,
  ): Promise<UserPublicDto[]> {
    const results = await this.usersService.search(query ?? '', user.id);
    return results.map((u) => UserPublicDto.fromEntity(u));
  }

  @Get(':handle')
  @ApiOperation({ summary: 'Get a public profile by handle' })
  async getByHandle(@Param('handle') handle: string): Promise<UserPublicDto> {
    const entity = await this.usersService.findByHandle(handle);
    if (!entity) throw new ResourceNotFoundException('User', handle);
    return UserPublicDto.fromEntity(entity);
  }
}
