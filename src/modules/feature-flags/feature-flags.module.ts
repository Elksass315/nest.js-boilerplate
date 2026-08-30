import { Module } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '@/modules/authorization';
import { FeatureFlagAuditEntity } from './entities/feature-flag-audit.entity';
import { FeatureFlagsEntity } from './entities/feature-flags.entity';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeatureFlagsEntity, FeatureFlagAuditEntity]),
    AuthorizationModule,
  ],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureFlagsRepository],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
