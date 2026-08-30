import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ReadinessRegistry } from './readiness-registry.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, ReadinessRegistry],
  exports: [ReadinessRegistry],
})
export class HealthModule {}
