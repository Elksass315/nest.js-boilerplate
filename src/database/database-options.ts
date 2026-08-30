import path from 'node:path';

import type { DataSourceOptions } from 'typeorm';

import type { DatabaseConfig } from './config/database.config';

export function createDatabaseOptions(config: DatabaseConfig): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.host,
    port: config.port,
    database: config.name,
    username: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: config.rejectUnauthorized } : false,
    synchronize: false,
    migrationsRun: false,
    logging: ['error'],
    connectTimeoutMS: config.connectTimeoutMs,
    extra: { max: config.poolSize },
    entities: [
      path.join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}'),
      path.join(__dirname, '..', 'core', '**', '*.entity.{ts,js}'),
    ],
    migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  };
}
