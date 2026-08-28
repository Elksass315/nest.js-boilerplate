import { Injectable } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';

import { UserAvatarAssociationEntity } from './entities/user-avatar-association.entity';

@Injectable()
export class UserAvatarsRepository {
  public findByUserId(
    manager: EntityManager,
    userId: string,
  ): Promise<UserAvatarAssociationEntity | null> {
    return this.repository(manager).findOneBy({ userId });
  }

  public async save(
    manager: EntityManager,
    userId: string,
    fileId: string,
  ): Promise<UserAvatarAssociationEntity> {
    const repository = this.repository(manager);
    const association = repository.create({ userId, fileId });
    return repository.save(association);
  }

  public async remove(manager: EntityManager, userId: string): Promise<void> {
    await this.repository(manager).delete({ userId });
  }

  private repository(manager: EntityManager): Repository<UserAvatarAssociationEntity> {
    return manager.getRepository(UserAvatarAssociationEntity);
  }
}
