import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { LocalStorageDriver } from './local-storage.driver';
import { S3StorageDriver } from './s3-storage.driver';
import { STORAGE_DRIVER } from './storage.interface';

@Global()
@Module({
  providers: [
    LocalStorageDriver,
    S3StorageDriver,
    {
      provide: STORAGE_DRIVER,
      inject: [AppConfigService, LocalStorageDriver, S3StorageDriver],
      useFactory: (
        config: AppConfigService,
        local: LocalStorageDriver,
        s3: S3StorageDriver,
      ) => (config.upload.driver === 's3' ? s3 : local),
    },
  ],
  exports: [STORAGE_DRIVER],
})
export class StorageModule {}
