import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import type { MailWorkerConfiguration } from '@/config/configuration.types';
import { loadMailWorkerConfiguration } from '@/config/environment';
import { CoreModule } from '@/core/core.module';
import { DatabaseModule } from '@/database/database.module';
import { MailWorkerConsumerModule } from '@/modules/mail/mail-worker.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      load: [loadMailWorkerConfiguration],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<MailWorkerConfiguration, true>) =>
        createLoggerOptions(config.getOrThrow('logging.level', { infer: true })),
    }),
    CoreModule,
    DatabaseModule,
    MailWorkerConsumerModule,
  ],
})
export class MailWorkerModule {}
