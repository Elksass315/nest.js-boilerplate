import type { Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfiguration } from '@/config/configuration.types';
import { FilesModule, FilesService } from '@/modules/files';

import {
  MAINTENANCE_CAPABILITY_CLEANER,
  type MaintenanceCapabilityCleaner,
} from './maintenance-capability-cleaner';

export const CAPABILITY_MAINTENANCE_IMPORTS: Type<unknown>[] = [FilesModule];
export const CAPABILITY_MAINTENANCE_PROVIDERS: Provider[] = [
  {
    provide: MAINTENANCE_CAPABILITY_CLEANER,
    inject: [FilesService, ConfigService],
    useFactory: (
      files: FilesService,
      config: ConfigService<AppConfiguration, true>,
    ): MaintenanceCapabilityCleaner => ({
      name: 'files',
      cleanup: (now: Date, limit: number): Promise<number> => {
        const days = config.getOrThrow('files.metadataRetentionDays', { infer: true });
        return files.cleanupTemporaryMetadata(new Date(now.getTime() - days * 86_400_000), limit);
      },
    }),
  },
];
