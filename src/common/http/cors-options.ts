import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function createCorsOptions(origins: readonly string[]): CorsOptions {
  return {
    origin: (origin, callback): void => {
      if (origin === undefined) {
        callback(null, false);
        return;
      }
      callback(null, origins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };
}
