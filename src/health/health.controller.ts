import { Controller, Get } from '@nestjs/common';
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
@Controller('health')
export class HealthController {
  public constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Check whether the API process is alive' })
  @ApiOkResponse({ description: 'The API process is alive.' })
  public getLiveness(): LivenessResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check whether required platform services are ready' })
  @ApiOkResponse({ description: 'PostgreSQL and Redis are reachable.' })
  @ApiServiceUnavailableResponse({ description: 'A required platform service is unavailable.' })
  public getReadiness(): Promise<ReadinessResponse> {
    return this.healthService.getReadiness();
  }
}
