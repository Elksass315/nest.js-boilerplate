import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { FeatureFlagAuditEntity } from './entities/feature-flag-audit.entity';
import { FeatureFlagsEntity } from './entities/feature-flags.entity';

@Injectable()
export class FeatureFlagsRepository {
  public constructor(
    @InjectRepository(FeatureFlagsEntity)
    private readonly repository: Repository<FeatureFlagsEntity>,
  ) {}

  public findPage(page: number, limit: number): Promise<[FeatureFlagsEntity[], number]> {
    return this.repository.findAndCount({
      order: { key: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public findByKey(key: string): Promise<FeatureFlagsEntity | null> {
    return this.repository.findOneBy({ key });
  }

  public create(
    manager: EntityManager,
    input: Pick<FeatureFlagsEntity, 'key' | 'description' | 'enabled' | 'updatedByUserId'>,
  ): Promise<FeatureFlagsEntity> {
    const repository = manager.getRepository(FeatureFlagsEntity);
    return repository.save(repository.create({ ...input, version: 1 }));
  }

  public findByKeyForUpdate(
    manager: EntityManager,
    key: string,
  ): Promise<FeatureFlagsEntity | null> {
    return manager
      .getRepository(FeatureFlagsEntity)
      .findOne({ where: { key }, lock: { mode: 'pessimistic_write' } });
  }

  public save(manager: EntityManager, flag: FeatureFlagsEntity): Promise<FeatureFlagsEntity> {
    return manager.getRepository(FeatureFlagsEntity).save(flag);
  }

  public async appendAudit(
    manager: EntityManager,
    input: Omit<FeatureFlagAuditEntity, 'id' | 'createdAt'>,
  ): Promise<void> {
    const repository = manager.getRepository(FeatureFlagAuditEntity);
    await repository.save(repository.create(input));
  }
}
