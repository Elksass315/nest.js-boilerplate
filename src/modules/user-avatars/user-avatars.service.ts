import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { UserAvatarsRepository } from './user-avatars.repository';

/**
 * Public avatar persistence boundary. Consumers do not need to know about the association entity
 * or the files provider. Existing users routes continue to be served by UsersService while new
 * projects can opt into this capability and migrate the legacy column through the supplied
 * migration.
 */
@Injectable()
export class UserAvatarsService {
  public constructor(private readonly repository: UserAvatarsRepository) {}

  public findFileId(manager: EntityManager, userId: string): Promise<string | null> {
    return this.repository
      .findByUserId(manager, userId)
      .then((association) => association?.fileId ?? null);
  }

  public async attach(manager: EntityManager, userId: string, fileId: string): Promise<void> {
    await this.repository.remove(manager, userId);
    await this.repository.save(manager, userId, fileId);
  }

  public remove(manager: EntityManager, userId: string): Promise<void> {
    return this.repository.remove(manager, userId);
  }
}
