import path from 'node:path';

import type { DataSourceOptions } from 'typeorm';

import type { EnvironmentVariables } from '@/config/environment';

export function createDatabaseOptions(environment: EnvironmentVariables): DataSourceOptions {
  return {
    type: 'postgres',
    host: environment.DATABASE_HOST,
    port: environment.DATABASE_PORT,
    database: environment.DATABASE_NAME,
    username: environment.DATABASE_USERNAME,
    password: environment.DATABASE_PASSWORD,
    ssl: environment.DATABASE_SSL_ENABLED
      ? { rejectUnauthorized: environment.DATABASE_REJECT_UNAUTHORIZED }
      : false,
    synchronize: false,
    migrationsRun: false,
    logging: environment.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    connectTimeoutMS: environment.DATABASE_CONNECT_TIMEOUT_MS,
    extra: {
      max: environment.DATABASE_POOL_SIZE,
    },
    entities: [path.join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
    migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  };
}
