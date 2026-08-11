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
    description: 'Checks PostgreSQL and Redis and reports a stable 503 error when either fails.',
  })
  @ApiOkResponse({
    description: 'PostgreSQL and Redis are reachable.',
    content: {
      'application/json': {
        example: {
          status: 'ok',
          timestamp: '2026-08-11T12:00:00.000Z',
          checks: { database: 'up', redis: 'up' },
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
              details: { checks: { database: 'down', redis: 'up' } },
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
              details: { checks: { database: 'up', redis: 'down' } },
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
