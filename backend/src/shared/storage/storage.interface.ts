export interface StoredFile {
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageDriver {
  save(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    folder: string;
  }): Promise<StoredFile>;

  delete(key: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
