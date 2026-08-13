import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import {
  STORAGE_DRIVER,
  StorageDriver,
} from '../shared/storage/storage.interface';
import {
  ConflictException,
  ForbiddenActionException,
  ResourceNotFoundException,
} from '../common/exceptions/app.exceptions';

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

// Attachments accept a broader set than avatars/icons, but this is still an
// explicit allow-list. Executable, HTML, and SVG/XML types are deliberately
// excluded: served from the static file host, an uploaded .html or .svg
// would run with the app's own origin and could be used for stored XSS or
// to distribute malware convincingly disguised as a "file share".
const ALLOWED_ATTACHMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'application/zip',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'video/mp4',
  'video/webm',
];

// Extensions are re-derived from the validated MIME type rather than
// trusted from the client-supplied filename, so a file can't be uploaded
// as e.g. "cat.png" with a .html/.svg/.exe payload smuggled past the
// MIME check via a mismatched extension.
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/zip': '.zip',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

export interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class UploadsService {
  constructor(
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  private assertWithinLimits(file: IncomingFile, allowedTypes: string[]) {
    const maxBytes = this.config.upload.maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new ConflictException(
        `File exceeds the ${this.config.upload.maxSizeMb}MB upload limit`,
      );
    }
    if (!allowedTypes.includes(file.mimetype)) {
      throw new ConflictException(`Unsupported file type: ${file.mimetype}`);
    }
  }

  /**
   * Never trust the client-supplied filename/extension for what gets
   * written to disk or served back — derive a safe extension purely from
   * the (already allow-listed) MIME type instead.
   */
  private safeFileName(mimetype: string): string {
    const ext = EXTENSION_BY_MIME[mimetype] ?? '';
    return `upload${ext}`;
  }

  async uploadAvatar(userId: string, file: IncomingFile) {
    this.assertWithinLimits(file, ALLOWED_IMAGE_TYPES);
    const stored = await this.storage.save({
      buffer: file.buffer,
      originalName: this.safeFileName(file.mimetype),
      mimeType: file.mimetype,
      folder: 'avatars',
    });

    await this.prisma.upload.create({
      data: {
        userId,
        kind: 'avatar',
        url: stored.url,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: stored.url },
    });

    return stored;
  }

  async uploadCommunityIcon(
    userId: string,
    communityId: string,
    file: IncomingFile,
  ) {
    this.assertWithinLimits(file, ALLOWED_IMAGE_TYPES);

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });
    if (!community)
      throw new ResourceNotFoundException('Community', communityId);
    if (community.ownerId !== userId) {
      throw new ForbiddenActionException(
        'Only the owner can change the community icon',
      );
    }

    const stored = await this.storage.save({
      buffer: file.buffer,
      originalName: this.safeFileName(file.mimetype),
      mimeType: file.mimetype,
      folder: 'community-icons',
    });

    await this.prisma.upload.create({
      data: {
        userId,
        kind: 'community-icon',
        url: stored.url,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      },
    });
    await this.prisma.community.update({
      where: { id: communityId },
      data: { iconUrl: stored.url },
    });

    return stored;
  }

  async uploadAttachment(userId: string, file: IncomingFile) {
    this.assertWithinLimits(file, ALLOWED_ATTACHMENT_TYPES);
    const stored = await this.storage.save({
      buffer: file.buffer,
      originalName: this.safeFileName(file.mimetype),
      mimeType: file.mimetype,
      folder: 'attachments',
    });

    await this.prisma.upload.create({
      data: {
        userId,
        kind: 'attachment',
        url: stored.url,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      },
    });

    return {
      ...stored,
      type: ALLOWED_IMAGE_TYPES.includes(file.mimetype)
        ? ('IMAGE' as const)
        : ('FILE' as const),
      name: file.originalname,
    };
  }
}
