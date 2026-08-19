import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { buildOffsetPage, type OffsetPage } from '@/common/pagination';
import { AppException } from '@/core/errors/app.exception';
import { RequestContextService } from '@/core/request-context/request-context.service';
import type { AuthenticatedPrincipal } from '@/modules/authorization';
import { isPlainRecord } from '@/shared/helpers/is-plain-record';

import type { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import type { FeatureFlagResponseDto } from './dto/feature-flag-response.dto';
import type { FeatureFlagsEntity } from './entities/feature-flags.entity';
import { FeatureFlagsRepository } from './feature-flags.repository';

@Injectable()
export class FeatureFlagsService {
  public constructor(
    private readonly repository: FeatureFlagsRepository,
    private readonly requestContext: RequestContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  public async isEnabled(key: string): Promise<boolean> {
    const flag = await this.repository.findByKey(key);
    if (!flag) throw new AppException('FEATURE_FLAG_NOT_FOUND');
    return flag.enabled;
  }

  public async list(page: number, limit: number): Promise<OffsetPage<FeatureFlagResponseDto>> {
    const [flags, total] = await this.repository.findPage(page, limit);
    return buildOffsetPage(
      flags.map((flag) => this.toResponse(flag)),
      total,
      page,
      limit,
    );
  }

  public async get(key: string): Promise<FeatureFlagResponseDto> {
    const flag = await this.repository.findByKey(key);
    if (!flag) throw new AppException('FEATURE_FLAG_NOT_FOUND');
    return this.toResponse(flag);
  }

  public async create(
    input: CreateFeatureFlagDto,
    principal: AuthenticatedPrincipal,
  ): Promise<FeatureFlagResponseDto> {
    const flag = await this.dataSource
      .transaction(async (manager) => {
        const created = await this.repository.create(manager, {
          key: input.key,
          description: input.description.trim(),
          enabled: input.enabled,
          updatedByUserId: principal.userId,
        });
        await this.appendAudit(manager, created.id, principal.userId, null, created.enabled);
        return created;
      })
      .catch((error: unknown) => {
        if (isPlainRecord(error) && error['code'] === '23505')
          throw new AppException('FEATURE_FLAG_ALREADY_EXISTS');
        throw error;
      });
    return this.toResponse(flag);
  }

  public async update(
    key: string,
    enabled: boolean,
    expectedVersion: number,
    principal: AuthenticatedPrincipal,
  ): Promise<FeatureFlagResponseDto> {
    const flag = await this.dataSource.transaction(async (manager) => {
      const current = await this.repository.findByKeyForUpdate(manager, key);
      if (!current) throw new AppException('FEATURE_FLAG_NOT_FOUND');
      if (current.version !== expectedVersion)
        throw new AppException('FEATURE_FLAG_VERSION_CONFLICT');
      if (current.enabled === enabled) return current;
      const previousEnabled = current.enabled;
      current.enabled = enabled;
      current.version += 1;
      current.updatedByUserId = principal.userId;
      const saved = await this.repository.save(manager, current);
      await this.appendAudit(manager, saved.id, principal.userId, previousEnabled, enabled);
      return saved;
    });
    return this.toResponse(flag);
  }

  private appendAudit(
    manager: EntityManager,
    featureFlagId: string,
    actorUserId: string,
    previousEnabled: boolean | null,
    enabled: boolean,
  ): Promise<void> {
    return this.repository.appendAudit(manager, {
      featureFlagId,
      actorUserId,
      previousEnabled,
      enabled,
      requestId: this.requestContext.getRequestId() ?? null,
      correlationId: this.requestContext.getCorrelationId() ?? null,
    });
  }

  private toResponse(flag: FeatureFlagsEntity): FeatureFlagResponseDto {
    return {
      id: flag.id,
      key: flag.key,
      description: flag.description,
      enabled: flag.enabled,
      version: flag.version,
      createdAt: flag.createdAt.toISOString(),
      updatedAt: flag.updatedAt.toISOString(),
    };
  }
}
