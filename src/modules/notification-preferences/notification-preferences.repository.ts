import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { NotificationPreferencesEntity } from './entities/notification-preferences.entity';

@Injectable()
export class NotificationPreferencesRepository {
  public constructor(
    @InjectRepository(NotificationPreferencesEntity)
    private readonly repository: Repository<NotificationPreferencesEntity>,
  ) {}

  public findByUserId(userId: string): Promise<NotificationPreferencesEntity | null> {
    return this.repository.findOneBy({ userId });
  }

  public findByUserIdForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<NotificationPreferencesEntity | null> {
    return manager.getRepository(NotificationPreferencesEntity).findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public save(
    manager: EntityManager,
    input: NotificationPreferencesEntity,
  ): Promise<NotificationPreferencesEntity> {
    return manager.getRepository(NotificationPreferencesEntity).save(input);
  }

  public create(
    manager: EntityManager,
    input: Pick<NotificationPreferencesEntity, 'userId' | 'productUpdatesEmail' | 'marketingEmail'>,
  ): NotificationPreferencesEntity {
    return manager.getRepository(NotificationPreferencesEntity).create({ ...input, version: 1 });
  }
}
