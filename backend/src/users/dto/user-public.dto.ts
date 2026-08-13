import { ApiProperty } from '@nestjs/swagger';
import { PresenceStatus, User } from '@prisma/client';

export class UserPublicDto {
  @ApiProperty() id!: string;
  @ApiProperty() handle!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ nullable: true }) avatarUrl!: string | null;
  @ApiProperty() avatarColor!: string;
  @ApiProperty() bannerAccent!: string;
  @ApiProperty({ nullable: true }) bio!: string | null;
  @ApiProperty() level!: number;
  @ApiProperty({ enum: PresenceStatus }) status!: PresenceStatus;
  @ApiProperty({ nullable: true }) statusText!: string | null;
  @ApiProperty({ nullable: true }) currentGame!: string | null;
  @ApiProperty() joinedAt!: Date;

  static fromEntity(user: User): UserPublicDto {
    const dto = new UserPublicDto();
    dto.id = user.id;
    dto.handle = user.handle;
    dto.displayName = user.displayName;
    dto.avatarUrl = user.avatarUrl;
    dto.avatarColor = user.avatarColor;
    dto.bannerAccent = user.bannerAccent;
    dto.bio = user.bio;
    dto.level = user.level;
    dto.status = user.status;
    dto.statusText = user.statusText;
    dto.currentGame = user.currentGame;
    dto.joinedAt = user.createdAt;
    return dto;
  }
}

export class UserPrivateDto extends UserPublicDto {
  @ApiProperty() email!: string;
  @ApiProperty() emailVerified!: boolean;

  static fromEntityPrivate(user: User): UserPrivateDto {
    const base = UserPublicDto.fromEntity(user);
    const dto = Object.assign(new UserPrivateDto(), base);
    dto.email = user.email;
    dto.emailVerified = Boolean(user.emailVerifiedAt);
    return dto;
  }
}
