import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthService } from './health.service';
import type { LivenessResponse, ReadinessResponse } from './health.types';

@ApiTags('health')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  public constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({
    summary: 'Check whether the API process is alive',
    description: 'Returns process-only liveness without checking PostgreSQL or Redis.',
  })
  @ApiOkResponse({
    description: 'The API process is alive.',
    content: {
      'application/json': {
        example: {
          status: 'ok',
          timestamp: '2026-08-11T12:00:00.000Z',
          uptimeSeconds: 42,
        },
      },
    },
  })
  public getLiveness(): LivenessResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Check whether required platform services are ready',
    description:
      'Checks PostgreSQL, Redis, and every enabled file read provider and reports a stable 503 error when one fails.',
  })
  @ApiOkResponse({
    description: 'PostgreSQL, Redis, and enabled file storage providers are reachable.',
    content: {
      'application/json': {
        example: {
          status: 'ok',
          timestamp: '2026-08-11T12:00:00.000Z',
          checks: { database: 'up', redis: 'up', storage: 'up' },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description:
      'A required platform dependency is unavailable. `message` identifies the failed readiness condition without exposing connection details.',
    content: {
      'application/json': {
        examples: {
          databaseUnavailable: {
            summary: 'PostgreSQL is unavailable',
            value: {
              statusCode: 503,
              code: 'SERVICE_NOT_READY',
              message: 'One or more required services are unavailable',
              timestamp: '2026-08-11T12:00:00.000Z',
              path: '/health/ready',
              requestId: '01J5EXAMPLE0000000000000000',
              correlationId: '01J5CORRELATION000000000000',
              details: { checks: { database: 'down', redis: 'up', storage: 'up' } },
            },
          },
          redisUnavailable: {
            summary: 'Redis is unavailable',
            value: {
              statusCode: 503,
              code: 'SERVICE_NOT_READY',
              message: 'One or more required services are unavailable',
              timestamp: '2026-08-11T12:00:00.000Z',
              path: '/health/ready',
              requestId: '01J5EXAMPLE0000000000000001',
              correlationId: '01J5CORRELATION000000000000',
              details: { checks: { database: 'up', redis: 'down', storage: 'up' } },
            },
          },
          storageUnavailable: {
            summary: 'An enabled file provider is unavailable',
            value: {
              statusCode: 503,
              code: 'SERVICE_NOT_READY',
              message: 'One or more required services are unavailable',
              timestamp: '2026-08-14T12:00:00.000Z',
              path: '/health/ready',
              requestId: '01J5EXAMPLE0000000000000002',
              correlationId: '01J5CORRELATION000000000000',
              details: { checks: { database: 'up', redis: 'up', storage: 'down' } },
            },
          },
        },
      },
    },
  })
  public getReadiness(): Promise<ReadinessResponse> {
    return this.healthService.getReadiness();
  }
}
