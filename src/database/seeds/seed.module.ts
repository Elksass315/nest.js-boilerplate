import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { loadDatabaseConfiguration } from '@/config/environment';
import type { DatabaseConfig } from '@/database/config/database.config';
import { createDatabaseOptions } from '@/database/database-options';

import { SeedRunnerService } from './seed-runner.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      load: [(): { database: DatabaseConfig } => ({ database: loadDatabaseConfiguration() })],
    }),
    TypeOrmModule.forRoot(createDatabaseOptions(loadDatabaseConfiguration())),
  ],
  providers: [SeedRunnerService],
  exports: [SeedRunnerService],
})
export class SeedModule {}
