import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { AppConfigService } from '../../config/app-config.service';
import { StorageDriver, StoredFile } from './storage.interface';

/**
 * S3 storage integration hook. Implements the same StorageDriver contract
 * as the local driver so swapping UPLOAD_DRIVER=s3 requires no changes
 * anywhere else in the codebase. The AWS SDK client is constructed lazily
 * and only touched when this driver is actually selected, so it never
 * requires AWS credentials to boot the app in local/dev.
 */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly logger = new Logger(S3StorageDriver.name);

  constructor(private readonly config: AppConfigService) {}

  async save(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    folder: string;
  }): Promise<StoredFile> {
    const { bucket, region, publicUrl } = this.config.upload.s3;
    if (!bucket || !region) {
      throw new Error(
        'S3 storage driver selected but S3_BUCKET/S3_REGION are not configured',
      );
    }

    const ext = path.extname(params.originalName) || '';
    const key = `${params.folder}/${randomUUID()}${ext}`;

    // Deliberately dynamic, non-literal import specifier: the AWS SDK is a
    // heavy optional dependency only needed when UPLOAD_DRIVER=s3 is
    // actually selected, and keeping the specifier non-literal means
    // TypeScript treats the imported module as `any` instead of requiring
    // '@aws-sdk/client-s3' to be installed just to type-check this file.
    const s3ModuleName = '@aws-sdk/client-s3';
    const { S3Client, PutObjectCommand } = await import(s3ModuleName).catch(
      () => {
        throw new Error(
          "UPLOAD_DRIVER=s3 requires '@aws-sdk/client-s3' to be installed (npm install @aws-sdk/client-s3)",
        );
      },
    );

    const client = new S3Client({ region });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.mimeType,
      }),
    );

    return {
      key,
      url: publicUrl
        ? `${publicUrl}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      mimeType: params.mimeType,
      sizeBytes: params.buffer.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    const { bucket, region } = this.config.upload.s3;
    if (!bucket || !region) return;

    const s3ModuleName = '@aws-sdk/client-s3';
    const { S3Client, DeleteObjectCommand } = await import(s3ModuleName).catch(
      () => {
        this.logger.warn(
          'Skipping S3 delete — @aws-sdk/client-s3 is not installed',
        );
        return { S3Client: null, DeleteObjectCommand: null } as never;
      },
    );
    if (!S3Client) return;

    const client = new S3Client({ region });
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
