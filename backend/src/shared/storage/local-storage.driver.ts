import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { StorageDriver, StoredFile } from './storage.interface';

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly config: AppConfigService) {}

  async save(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    folder: string;
  }): Promise<StoredFile> {
    const { localDir } = this.config.upload;
    const ext = path.extname(params.originalName) || '';
    const key = `${params.folder}/${randomUUID()}${ext}`;
    const fullPath = path.join(localDir, key);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, params.buffer);

    return {
      key,
      url: `${this.config.apiUrl}/static/${key}`,
      mimeType: params.mimeType,
      sizeBytes: params.buffer.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    const { localDir } = this.config.upload;
    const fullPath = path.join(localDir, key);
    await fs.rm(fullPath, { force: true });
  }
}
