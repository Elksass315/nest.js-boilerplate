import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import type { AppConfiguration } from '@/config/configuration.types';
import { loadApiConfiguration } from '@/config/environment';
import { CoreModule } from '@/core/core.module';
import { OutboxModule } from '@/core/outbox/outbox.module';
import { DatabaseModule } from '@/database/database.module';
import { AuthModule } from '@/modules/auth';
import { FilesModule } from '@/modules/files';
import { MailModule } from '@/modules/mail';

import { MaintenanceWorkerService } from './maintenance-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [loadApiConfiguration] }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) =>
        createLoggerOptions(config.getOrThrow('logging.level', { infer: true })),
    }),
    DatabaseModule,
    CoreModule,
    OutboxModule,
    MailModule,
    FilesModule,
    AuthModule,
  ],
  providers: [MaintenanceWorkerService],
  exports: [MaintenanceWorkerService],
})
export class MaintenanceWorkerModule {}
