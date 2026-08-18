import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, type Repository } from 'typeorm';

import { UserRoleEntity } from './entities/user-role.entity';
import { UserSecurityAuditEntity } from './entities/user-security-audit.entity';
import { UserEntity } from './entities/user.entity';
import type { SecurityAuditEvent, UserStatus } from './users.constants';

export interface SecurityAuditInput {
  userId: string | null;
  actorUserId: string | null;
  eventType: SecurityAuditEvent;
  requestId: string | null;
  correlationId: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class UsersRepository {
  public constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity) private readonly userRoles: Repository<UserRoleEntity>,
  ) {}

  public findPage(page: number, limit: number): Promise<[UserEntity[], number]> {
    return this.users.findAndCount({
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public findById(id: string, manager?: EntityManager): Promise<UserEntity | null> {
    return (manager?.getRepository(UserEntity) ?? this.users).findOneBy({ id });
  }

  public findByNormalizedEmail(normalizedEmail: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ normalizedEmail });
  }

  public findByIdForUpdate(manager: EntityManager, id: string): Promise<UserEntity | null> {
    return manager.getRepository(UserEntity).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public async saveWithAudit(
    manager: EntityManager,
    user: UserEntity,
    audit: SecurityAuditInput,
  ): Promise<UserEntity> {
    const saved = await manager.getRepository(UserEntity).save(user);
    await this.appendAudit(manager, audit);
    return saved;
  }

  public async roleIdsByUserIds(userIds: readonly string[]): Promise<Map<string, string[]>> {
    if (userIds.length === 0) return new Map();
    const assignments = await this.userRoles.find({
      where: { userId: In([...userIds]) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const result = new Map<string, string[]>();
    for (const assignment of assignments) {
      result.set(assignment.userId, [...(result.get(assignment.userId) ?? []), assignment.roleId]);
    }
    return result;
  }

  public async createWithRole(
    manager: EntityManager,
    input: Pick<UserEntity, 'fullName' | 'email' | 'normalizedEmail' | 'passwordHash'>,
    roleId: string,
    audit: SecurityAuditInput,
  ): Promise<UserEntity> {
    const user = await manager.getRepository(UserEntity).save(
      manager.getRepository(UserEntity).create({
        ...input,
        status: 'pending_verification',
        emailVerifiedAt: null,
        emailTwoStepEnabled: false,
        authVersion: 1,
        failedLoginCount: 0,
        lockedUntil: null,
        avatarFileId: null,
      }),
    );
    await manager
      .getRepository(UserRoleEntity)
      .save(manager.getRepository(UserRoleEntity).create({ userId: user.id, roleId }));
    await this.appendAudit(manager, { ...audit, userId: user.id });
    return user;
  }

  public async createActiveWithRole(
    manager: EntityManager,
    input: Pick<UserEntity, 'fullName' | 'email' | 'normalizedEmail' | 'passwordHash'>,
    roleId: string,
    audit: SecurityAuditInput,
  ): Promise<UserEntity> {
    const userRepository = manager.getRepository(UserEntity);
    const user = await userRepository.save(
      userRepository.create({
        ...input,
        status: 'active',
        emailVerifiedAt: new Date(),
        emailTwoStepEnabled: false,
        authVersion: 1,
        failedLoginCount: 0,
        lockedUntil: null,
        avatarFileId: null,
      }),
    );
    const roleRepository = manager.getRepository(UserRoleEntity);
    await roleRepository.save(roleRepository.create({ userId: user.id, roleId }));
    await this.appendAudit(manager, { ...audit, userId: user.id, actorUserId: user.id });
    return user;
  }

  public async updateProfile(
    manager: EntityManager,
    id: string,
    fullName: string,
    audit: SecurityAuditInput,
  ): Promise<UserEntity | null> {
    const user = await this.findById(id, manager);
    if (!user) return null;
    user.fullName = fullName;
    const saved = await manager.getRepository(UserEntity).save(user);
    await this.appendAudit(manager, audit);
    return saved;
  }

  public async updateStatus(
    manager: EntityManager,
    id: string,
    status: UserStatus,
    audit: SecurityAuditInput,
  ): Promise<UserEntity | null> {
    const user = await this.findById(id, manager);
    if (!user) return null;
    user.status = status;
    user.authVersion += 1;
    const saved = await manager.getRepository(UserEntity).save(user);
    await this.appendAudit(manager, audit);
    return saved;
  }

  public async replaceRoles(
    manager: EntityManager,
    userId: string,
    roleIds: readonly string[],
    audit: SecurityAuditInput,
  ): Promise<UserEntity | null> {
    const user = await this.findById(userId, manager);
    if (!user) return null;
    await manager.getRepository(UserRoleEntity).delete({ userId });
    await manager
      .getRepository(UserRoleEntity)
      .insert(
        roleIds.map((roleId) => manager.getRepository(UserRoleEntity).create({ userId, roleId })),
      );
    user.authVersion += 1;
    const saved = await manager.getRepository(UserEntity).save(user);
    await this.appendAudit(manager, audit);
    return saved;
  }

  public countActiveUsersWithRole(roleId: string, manager?: EntityManager): Promise<number> {
    return (manager?.getRepository(UserEntity) ?? this.users)
      .createQueryBuilder('user')
      .innerJoin(UserRoleEntity, 'userRole', 'userRole.user_id = user.id')
      .where('userRole.role_id = :roleId', { roleId })
      .andWhere('user.status = :status', { status: 'active' satisfies UserStatus })
      .getCount();
  }

  public hasRole(userId: string, roleId: string, manager?: EntityManager): Promise<boolean> {
    return (manager?.getRepository(UserRoleEntity) ?? this.userRoles).existsBy({ userId, roleId });
  }

  public async lockSuperAdminPolicy(manager: EntityManager): Promise<void> {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext('users:last-super-admin'))");
  }

  public async appendAudit(manager: EntityManager, input: SecurityAuditInput): Promise<void> {
    const audit = new UserSecurityAuditEntity();
    audit.userId = input.userId;
    audit.actorUserId = input.actorUserId;
    audit.eventType = input.eventType;
    audit.requestId = input.requestId;
    audit.correlationId = input.correlationId;
    audit.metadata = input.metadata ?? {};
    await manager.getRepository(UserSecurityAuditEntity).save(audit);
  }
}
