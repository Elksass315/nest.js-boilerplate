import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { InvitationEntity } from './entities/invitation.entity';

@Injectable()
export class InvitationsRepository {
  public constructor(
    @InjectRepository(InvitationEntity)
    private readonly invitations: Repository<InvitationEntity>,
  ) {}

  public findPage(page: number, limit: number): Promise<[InvitationEntity[], number]> {
    return this.invitations.findAndCount({
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public findById(id: string): Promise<InvitationEntity | null> {
    return this.invitations.findOneBy({ id });
  }

  public findByTokenHash(tokenHash: string): Promise<InvitationEntity | null> {
    return this.invitations.findOneBy({ tokenHash });
  }

  public findByIdForUpdate(manager: EntityManager, id: string): Promise<InvitationEntity | null> {
    return manager.getRepository(InvitationEntity).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public findByTokenHashForUpdate(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<InvitationEntity | null> {
    return manager.getRepository(InvitationEntity).findOne({
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public findPendingByEmailForUpdate(
    manager: EntityManager,
    normalizedEmail: string,
  ): Promise<InvitationEntity | null> {
    return manager.getRepository(InvitationEntity).findOne({
      where: { normalizedEmail, status: 'pending' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public create(
    manager: EntityManager,
    input: Omit<InvitationEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<InvitationEntity> {
    const repository = manager.getRepository(InvitationEntity);
    return repository.save(repository.create(input));
  }

  public save(manager: EntityManager, invitation: InvitationEntity): Promise<InvitationEntity> {
    return manager.getRepository(InvitationEntity).save(invitation);
  }
}
