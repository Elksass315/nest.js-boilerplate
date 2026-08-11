import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { buildOffsetPage, type OffsetPage } from '@/common/pagination';
import { AppException } from '@/core/errors/app.exception';
import { RequestContextService } from '@/core/request-context/request-context.service';
import { AuthorizationService, type RoleDefinition } from '@/modules/authorization';
import { isPlainRecord } from '@/shared/helpers/is-plain-record';

import type { UserResponseDto } from './dto/user-response.dto';
import type { UserEntity } from './entities/user.entity';
import type { CreatePendingUserInput, UserWithRoles } from './users.types';
import type { UserStatus } from './users.constants';
import { UsersRepository, type SecurityAuditInput } from './users.repository';

@Injectable()
export class UsersService {
  public constructor(
    private readonly repository: UsersRepository,
    private readonly authorization: AuthorizationService,
    private readonly requestContext: RequestContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  public async list(page: number, limit: number): Promise<OffsetPage<UserResponseDto>> {
    const [users, total] = await this.repository.findPage(page, limit);
    const roles = await this.rolesByUserId(users.map(({ id }) => id));
    return buildOffsetPage(
      users.map((user) => this.toResponse(user, roles.get(user.id) ?? [])),
      total,
      page,
      limit,
    );
  }

  public async getById(id: string): Promise<UserResponseDto> {
    const user = await this.requireUser(id);
    return this.toResponse(user, await this.rolesForUser(id));
  }

  public getSelf(userId: string): Promise<UserResponseDto> {
    return this.getById(userId);
  }

  public async updateOwnProfile(userId: string, fullName: string): Promise<UserResponseDto> {
    const user = await this.dataSource.transaction((manager) =>
      this.repository.updateProfile(manager, userId, fullName.trim(), {
        ...this.auditContext(userId, userId, 'user.profile.updated'),
        metadata: { changedFields: ['fullName'] },
      }),
    );
    if (!user) throw new AppException('USER_NOT_FOUND');
    return this.toResponse(user, await this.rolesForUser(user.id));
  }

  public async updateStatus(
    id: string,
    status: UserStatus,
    actorUserId: string,
  ): Promise<UserResponseDto> {
    const superAdmin = await this.authorization.getRequiredRole('super_admin');
    const user = await this.dataSource.transaction(async (manager) => {
      await this.repository.lockSuperAdminPolicy(manager);
      const current = await this.repository.findById(id, manager);
      if (!current) throw new AppException('USER_NOT_FOUND');
      if (
        current.status === 'active' &&
        status !== 'active' &&
        (await this.repository.hasRole(id, superAdmin.id, manager)) &&
        (await this.repository.countActiveUsersWithRole(superAdmin.id, manager)) <= 1
      ) {
        throw new AppException('LAST_SUPER_ADMIN');
      }
      return this.repository.updateStatus(
        manager,
        id,
        status,
        this.auditContext(id, actorUserId, 'user.status.changed', {
          previousStatus: current.status,
          nextStatus: status,
        }),
      );
    });
    if (!user) throw new AppException('USER_NOT_FOUND');
    return this.toResponse(user, await this.rolesForUser(user.id));
  }

  public async replaceRoles(
    id: string,
    roleIds: readonly string[],
    actorUserId: string,
  ): Promise<UserResponseDto> {
    const requestedRoles = await this.authorization.requireRoleIds(roleIds);
    const superAdmin = await this.authorization.getRequiredRole('super_admin');
    const user = await this.dataSource.transaction(async (manager) => {
      await this.repository.lockSuperAdminPolicy(manager);
      const current = await this.repository.findById(id, manager);
      if (!current) throw new AppException('USER_NOT_FOUND');
      const currentlySuperAdmin = await this.repository.hasRole(id, superAdmin.id, manager);
      const remainsSuperAdmin = requestedRoles.some(({ id: roleId }) => roleId === superAdmin.id);
      if (
        current.status === 'active' &&
        currentlySuperAdmin &&
        !remainsSuperAdmin &&
        (await this.repository.countActiveUsersWithRole(superAdmin.id, manager)) <= 1
      ) {
        throw new AppException('LAST_SUPER_ADMIN');
      }
      return this.repository.replaceRoles(
        manager,
        id,
        roleIds,
        this.auditContext(id, actorUserId, 'user.roles.changed', {
          nextRoleKeys: requestedRoles.map(({ key }) => key),
        }),
      );
    });
    if (!user) throw new AppException('USER_NOT_FOUND');
    return this.toResponse(user, requestedRoles);
  }

  public async createPendingUser(input: CreatePendingUserInput): Promise<UserWithRoles> {
    if (await this.repository.findByNormalizedEmail(input.normalizedEmail)) {
      throw new AppException('EMAIL_ALREADY_REGISTERED');
    }
    const defaultRole = await this.authorization.getRequiredRole('user');
    try {
      const user = await this.dataSource.transaction((manager) =>
        this.repository.createWithRole(
          manager,
          input,
          defaultRole.id,
          this.auditContext(null, null, 'user.created'),
        ),
      );
      return this.toUserWithRoles(user, [defaultRole]);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new AppException('EMAIL_ALREADY_REGISTERED');
      throw error;
    }
  }

  public async findForAuthentication(normalizedEmail: string): Promise<UserWithRoles | null> {
    const user = await this.repository.findByNormalizedEmail(normalizedEmail);
    if (!user) return null;
    return this.toUserWithRoles(user, await this.rolesForUser(user.id));
  }

  private async requireUser(id: string): Promise<UserEntity> {
    const user = await this.repository.findById(id);
    if (!user) throw new AppException('USER_NOT_FOUND');
    return user;
  }

  private async rolesForUser(userId: string): Promise<RoleDefinition[]> {
    return (await this.rolesByUserId([userId])).get(userId) ?? [];
  }

  private async rolesByUserId(userIds: readonly string[]): Promise<Map<string, RoleDefinition[]>> {
    const roleIdsByUser = await this.repository.roleIdsByUserIds(userIds);
    const allRoleIds = [...new Set([...roleIdsByUser.values()].flat())];
    const roles = await this.authorization.resolveRoles(allRoleIds);
    const rolesById = new Map(roles.map((role) => [role.id, role]));
    return new Map(
      userIds.map((userId) => [
        userId,
        (roleIdsByUser.get(userId) ?? []).flatMap((roleId) => {
          const role = rolesById.get(roleId);
          return role ? [role] : [];
        }),
      ]),
    );
  }

  private toResponse(user: UserEntity, roles: readonly RoleDefinition[]): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      emailTwoStepEnabled: user.emailTwoStepEnabled,
      roles: roles.map(({ key }) => key),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private toUserWithRoles(user: UserEntity, roles: RoleDefinition[]): UserWithRoles {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      normalizedEmail: user.normalizedEmail,
      passwordHash: user.passwordHash,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      emailTwoStepEnabled: user.emailTwoStepEnabled,
      authVersion: user.authVersion,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles,
    };
  }

  private auditContext(
    userId: string | null,
    actorUserId: string | null,
    eventType: SecurityAuditInput['eventType'],
    metadata?: Record<string, unknown>,
  ): SecurityAuditInput {
    return {
      userId,
      actorUserId,
      eventType,
      requestId: this.requestContext.getRequestId() ?? null,
      correlationId: this.requestContext.getCorrelationId() ?? null,
      ...(metadata ? { metadata } : {}),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return isPlainRecord(error) && error['code'] === '23505';
  }
}
