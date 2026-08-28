import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { buildOffsetPage, type OffsetPage } from '@/common/pagination';
import { AppException } from '@/core/errors/app.exception';
import { RequestContextService } from '@/core/request-context/request-context.service';
import { AuthorizationService, type RoleDefinition } from '@/modules/authorization';
import { FilesService, type PreparedFileContent, type PublicFileDescriptor } from '@/modules/files';
import { MailService } from '@/modules/mail';
import { isPlainRecord } from '@/shared/helpers/is-plain-record';

import type { UserResponseDto } from './dto/user-response.dto';
import type {
  SecurityAuditDetail,
  SecurityAuditResponseDto,
} from './dto/security-audit-response.dto';
import { AvatarImageService } from './avatar-image.service';
import type { UserSecurityAuditEntity } from './entities/user-security-audit.entity';
import type { UserEntity } from './entities/user.entity';
import type {
  CreateInvitedUserInput,
  CreatePendingUserInput,
  InvitedUserResult,
  UserWithRoles,
} from './users.types';
import type { UserStatus } from './users.constants';
import type { Permission } from '@/modules/authorization';
import type { RoleKey } from '@/modules/authorization';
import type { ReplaceUserPermissionsDto } from './dto/replace-user-permissions.dto';
import type { UserPermissionsResponseDto } from './dto/user-permissions-response.dto';
import { UsersRepository, type SecurityAuditInput } from './users.repository';

type AvatarClaimResult =
  | { user: UserEntity; avatar: null; replacedFileId: null; idempotent: true }
  | {
      user: UserEntity;
      avatar: PublicFileDescriptor;
      replacedFileId: string | null;
      idempotent: false;
    };

const PUBLIC_AUDIT_DETAIL_KEYS: Partial<
  Record<SecurityAuditInput['eventType'], readonly string[]>
> = {
  'user.profile.updated': ['changedFields'],
  'user.avatar.changed': ['action', 'hadPreviousAvatar'],
  'user.status.changed': ['previousStatus', 'nextStatus'],
  'user.roles.changed': ['nextRoleKeys'],
  'user.permissions.changed': ['grants', 'revokes'],
  'auth.login.failed': ['failedLoginCount', 'locked'],
  'team.invitation.created': ['invitationId', 'role'],
  'team.invitation.resent': ['invitationId'],
  'team.invitation.revoked': ['invitationId'],
  'team.invitation.accepted': ['invitationId'],
};

const PROTECTED_OVERRIDE_GRANTS = new Set<Permission>([
  'users.permissions.manage',
  'users.roles.manage',
]);

@Injectable()
export class UsersService {
  public constructor(
    private readonly repository: UsersRepository,
    private readonly authorization: AuthorizationService,
    private readonly files: FilesService,
    private readonly avatarImages: AvatarImageService,
    private readonly mail: MailService,
    private readonly requestContext: RequestContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  public async list(page: number, limit: number): Promise<OffsetPage<UserResponseDto>> {
    const [users, total] = await this.repository.findPage(page, limit);
    const roles = await this.rolesByUserId(users.map(({ id }) => id));
    const avatars = await this.avatarsByFileId(users.map(({ avatarFileId }) => avatarFileId));
    return buildOffsetPage(
      users.map((user) =>
        this.toResponse(
          user,
          roles.get(user.id) ?? [],
          user.avatarFileId ? (avatars.get(user.avatarFileId) ?? null) : null,
        ),
      ),
      total,
      page,
      limit,
    );
  }

  public async getById(id: string): Promise<UserResponseDto> {
    const user = await this.requireUser(id);
    return this.responseFor(user, await this.rolesForUser(id));
  }

  public getSelf(userId: string): Promise<UserResponseDto> {
    return this.getById(userId);
  }

  public async getPermissionOverrides(userId: string): Promise<UserPermissionsResponseDto> {
    await this.requireUser(userId);
    const roles = await this.rolesForUser(userId);
    const overrides = await this.authorization.getUserPermissionOverrides(userId);
    return {
      effective: [...new Set(roles.flatMap(({ permissions }) => permissions))].sort(),
      grants: overrides.filter(({ effect }) => effect === 'grant').map(({ key }) => key),
      revokes: overrides.filter(({ effect }) => effect === 'revoke').map(({ key }) => key),
    };
  }

  public async replacePermissionOverrides(
    userId: string,
    input: ReplaceUserPermissionsDto,
    actorUserId: string,
    actorRoleKeys: readonly RoleKey[],
  ): Promise<UserPermissionsResponseDto> {
    if (!actorRoleKeys.includes('super_admin')) throw new AppException('FORBIDDEN');
    const grants = [...new Set(input.grants)] as Permission[];
    const revokes = [...new Set(input.revokes)] as Permission[];
    if (grants.some((permission) => revokes.includes(permission))) {
      throw new AppException('RESOURCE_CONFLICT');
    }
    if (grants.some((permission) => PROTECTED_OVERRIDE_GRANTS.has(permission))) {
      throw new AppException('FORBIDDEN');
    }
    const user = await this.requireUser(userId);
    const roles = await this.rolesForUser(userId);
    if (roles.some(({ key }) => key === 'super_admin')) throw new AppException('FORBIDDEN');
    const permissionIds = await this.authorization.resolvePermissionKeys([...grants, ...revokes]);
    if (permissionIds.size !== grants.length + revokes.length)
      throw new AppException('RESOURCE_NOT_FOUND');
    await this.dataSource.transaction(async (manager) => {
      const rows = [...grants, ...revokes].flatMap((key) => {
        const permissionId = permissionIds.get(key);
        return permissionId
          ? [
              {
                permissionId,
                effect: grants.includes(key) ? ('grant' as const) : ('revoke' as const),
              },
            ]
          : [];
      });
      await this.authorization.replaceUserPermissionOverrides(manager, userId, rows);
      user.authVersion += 1;
      await this.repository.saveWithAudit(manager, user, {
        ...this.auditContext(userId, actorUserId, 'user.permissions.changed'),
        metadata: { grants, revokes },
      });
    });
    return this.getPermissionOverrides(userId);
  }

  public listOwnSecurityAudits(
    userId: string,
    page: number,
    limit: number,
  ): Promise<OffsetPage<SecurityAuditResponseDto>> {
    return this.listSecurityAudits(userId, page, limit, false);
  }

  public listUserSecurityAudits(
    userId: string,
    page: number,
    limit: number,
  ): Promise<OffsetPage<SecurityAuditResponseDto>> {
    return this.listSecurityAudits(userId, page, limit, true);
  }

  public async updateOwnProfile(userId: string, fullName: string): Promise<UserResponseDto> {
    const user = await this.dataSource.transaction((manager) =>
      this.repository.updateProfile(manager, userId, fullName.trim(), {
        ...this.auditContext(userId, userId, 'user.profile.updated'),
        metadata: { changedFields: ['fullName'] },
      }),
    );
    if (!user) throw new AppException('USER_NOT_FOUND');
    return this.responseFor(user, await this.rolesForUser(user.id));
  }

  public async replaceOwnAvatar(userId: string, fileId: string): Promise<UserResponseDto> {
    const existing = await this.requireUser(userId);
    if (existing.avatarFileId === fileId) {
      return this.responseFor(existing, await this.rolesForUser(userId));
    }

    const limits = this.avatarImages.getLimits();
    const uploaded = await this.files.readUploadedForOwner(
      fileId,
      userId,
      'user_avatar',
      limits.maxBytes,
    );
    const sanitized = await this.avatarImages.sanitize(uploaded);
    const prepared = await this.files.prepareReplacement(
      fileId,
      userId,
      'user_avatar',
      sanitized.bytes,
      sanitized.mimeType,
    );

    const result = await this.claimAvatarTransaction(userId, fileId, prepared).catch(
      async (error: unknown) => {
        await this.files.discardPrepared(prepared);
        throw error;
      },
    );
    if (result.idempotent) {
      await this.files.discardPrepared(prepared);
      return this.responseFor(result.user, await this.rolesForUser(userId));
    }
    return this.toResponse(result.user, await this.rolesForUser(userId), result.avatar);
  }

  public async deleteOwnAvatar(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await this.repository.findByIdForUpdate(manager, userId);
      if (!user) throw new AppException('USER_NOT_FOUND');
      const fileId = user.avatarFileId;
      if (!fileId) return null;
      await this.files.markDeletingForOwner(manager, fileId, userId, 'user_avatar');
      user.avatarFileId = null;
      await this.repository.saveWithAudit(
        manager,
        user,
        this.auditContext(userId, userId, 'user.avatar.changed', { action: 'removed' }),
      );
      await this.files.scheduleDeletion(
        fileId,
        this.requestContext.getCorrelationId() ?? 'unavailable',
        manager,
      );
      return fileId;
    });
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
      const updated = await this.repository.updateStatus(
        manager,
        id,
        status,
        this.auditContext(id, actorUserId, 'user.status.changed', {
          previousStatus: current.status,
          nextStatus: status,
        }),
      );
      if (updated) {
        await this.mail.sendAccountStatusChanged(
          { email: updated.email, fullName: updated.fullName, status, occurredAt: new Date() },
          manager,
        );
      }
      return updated;
    });
    if (!user) throw new AppException('USER_NOT_FOUND');
    return this.responseFor(user, await this.rolesForUser(user.id));
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
      const audit = this.auditContext(id, actorUserId, 'user.roles.changed', {
        nextRoleKeys: requestedRoles.map(({ key }) => key),
      });
      const updated = await this.repository.replaceRoles(manager, id, roleIds, audit);
      if (updated) {
        await this.mail.sendRoleChanged(
          {
            email: updated.email,
            fullName: updated.fullName,
            roles: requestedRoles.map(({ key }) => key),
            occurredAt: new Date(),
          },
          manager,
        );
      }
      return updated;
    });
    if (!user) throw new AppException('USER_NOT_FOUND');
    return this.responseFor(user, requestedRoles);
  }

  public async createOrUpdatePendingUser(
    input: CreatePendingUserInput,
    transactionManager?: EntityManager,
  ): Promise<UserWithRoles> {
    const defaultRole = await this.authorization.getRequiredRole('user');
    const write = async (manager: EntityManager): Promise<UserEntity> => {
      await this.repository.lockRegistrationEmail(manager, input.normalizedEmail);
      const existing = await this.repository.findByNormalizedEmail(input.normalizedEmail, manager);
      if (existing) {
        if (existing.status !== 'pending_verification') {
          throw new AppException('EMAIL_ALREADY_REGISTERED');
        }
        existing.fullName = input.fullName;
        existing.email = input.email;
        existing.passwordHash = input.passwordHash;
        return this.repository.saveWithAudit(
          manager,
          existing,
          this.auditContext(existing.id, null, 'auth.registration.updated'),
        );
      }
      return this.repository.createWithRole(
        manager,
        input,
        defaultRole.id,
        this.auditContext(null, null, 'user.created'),
      );
    };
    try {
      const user = transactionManager
        ? await write(transactionManager)
        : await this.dataSource.transaction(write);
      return this.toUserWithRoles(user, [defaultRole]);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new AppException('EMAIL_ALREADY_REGISTERED');
      throw error;
    }
  }

  public async createInvitedUser(
    manager: EntityManager,
    input: CreateInvitedUserInput,
    roleId: string,
    invitationId: string,
  ): Promise<InvitedUserResult> {
    try {
      const audit = this.auditContext(null, null, 'team.invitation.accepted', { invitationId });
      const user = await this.repository.createActiveWithRole(manager, input, roleId, audit);
      return { id: user.id, fullName: user.fullName, email: user.email };
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new AppException('MEMBER_ALREADY_EXISTS');
      throw error;
    }
  }

  public async findForAuthentication(normalizedEmail: string): Promise<UserWithRoles | null> {
    const user = await this.repository.findByNormalizedEmail(normalizedEmail);
    if (!user) return null;
    return this.toUserWithRoles(user, await this.rolesForUser(user.id));
  }

  public async emailExists(normalizedEmail: string): Promise<boolean> {
    return (await this.repository.findByNormalizedEmail(normalizedEmail)) !== null;
  }

  public recordSecurityAudit(
    actorUserId: string,
    eventType: SecurityAuditInput['eventType'],
    metadata?: Record<string, unknown>,
    transactionManager?: EntityManager,
  ): Promise<void> {
    const append = (manager: EntityManager): Promise<void> =>
      this.repository.appendAudit(
        manager,
        this.auditContext(actorUserId, actorUserId, eventType, metadata),
      );
    return transactionManager ? append(transactionManager) : this.dataSource.transaction(append);
  }

  public async findByIdForAuthentication(id: string): Promise<UserWithRoles | null> {
    const user = await this.repository.findById(id);
    if (!user) return null;
    return this.toUserWithRoles(user, await this.rolesForUser(user.id));
  }

  public async verifyEmail(
    userId: string,
    transactionManager?: EntityManager,
  ): Promise<UserWithRoles> {
    const verify = async (manager: EntityManager): Promise<UserEntity> => {
      const current = await this.repository.findByIdForUpdate(manager, userId);
      if (!current) throw new AppException('USER_NOT_FOUND');
      if (current.status === 'suspended') throw new AppException('ACCOUNT_SUSPENDED');
      current.emailVerifiedAt ??= new Date();
      current.status = 'active';
      return this.repository.saveWithAudit(
        manager,
        current,
        this.auditContext(userId, userId, 'auth.email.verified'),
      );
    };
    const user = transactionManager
      ? await verify(transactionManager)
      : await this.dataSource.transaction(verify);
    return this.toUserWithRoles(user, await this.rolesForUser(user.id));
  }

  public async recordFailedLogin(
    userId: string,
    maximum: number,
    lockSeconds: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await this.repository.findByIdForUpdate(manager, userId);
      if (!user) return;
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= maximum) {
        user.lockedUntil = new Date(Date.now() + lockSeconds * 1000);
      }
      await this.repository.saveWithAudit(
        manager,
        user,
        this.auditContext(userId, userId, 'auth.login.failed', {
          failedLoginCount: user.failedLoginCount,
          locked: user.lockedUntil !== null,
        }),
      );
    });
  }

  public async recordSuccessfulLogin(userId: string): Promise<UserWithRoles> {
    const user = await this.dataSource.transaction(async (manager) => {
      const current = await this.repository.findByIdForUpdate(manager, userId);
      if (!current) throw new AppException('USER_NOT_FOUND');
      current.failedLoginCount = 0;
      current.lockedUntil = null;
      return this.repository.saveWithAudit(
        manager,
        current,
        this.auditContext(userId, userId, 'auth.login.succeeded'),
      );
    });
    return this.toUserWithRoles(user, await this.rolesForUser(user.id));
  }

  public async changePassword(
    userId: string,
    passwordHash: string,
    eventType: 'auth.password.changed' | 'auth.password.reset',
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await this.repository.findByIdForUpdate(manager, userId);
      if (!user) throw new AppException('USER_NOT_FOUND');
      user.passwordHash = passwordHash;
      user.authVersion += 1;
      await this.repository.saveWithAudit(
        manager,
        user,
        this.auditContext(userId, userId, eventType),
      );
    });
  }

  public async setEmailTwoStep(userId: string, enabled: boolean): Promise<UserWithRoles> {
    const user = await this.dataSource.transaction(async (manager) => {
      const current = await this.repository.findByIdForUpdate(manager, userId);
      if (!current) throw new AppException('USER_NOT_FOUND');
      current.emailTwoStepEnabled = enabled;
      current.authVersion += 1;
      return this.repository.saveWithAudit(
        manager,
        current,
        this.auditContext(
          userId,
          userId,
          enabled ? 'auth.two_step.enabled' : 'auth.two_step.disabled',
        ),
      );
    });
    return this.toUserWithRoles(user, await this.rolesForUser(user.id));
  }

  public async auditRecoveryCodesRegenerated(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await this.repository.findByIdForUpdate(manager, userId);
      if (!user) throw new AppException('USER_NOT_FOUND');
      await this.repository.saveWithAudit(
        manager,
        user,
        this.auditContext(userId, userId, 'auth.recovery_codes.regenerated'),
      );
    });
  }

  private async requireUser(id: string): Promise<UserEntity> {
    const user = await this.repository.findById(id);
    if (!user) throw new AppException('USER_NOT_FOUND');
    return user;
  }

  private async listSecurityAudits(
    userId: string,
    page: number,
    limit: number,
    requireExistingUser: boolean,
  ): Promise<OffsetPage<SecurityAuditResponseDto>> {
    if (requireExistingUser) await this.requireUser(userId);
    const [audits, total] = await this.repository.findSecurityAuditPage(userId, page, limit);
    return buildOffsetPage(
      audits.map((audit) => this.toSecurityAuditResponse(audit)),
      total,
      page,
      limit,
    );
  }

  private toSecurityAuditResponse(audit: UserSecurityAuditEntity): SecurityAuditResponseDto {
    const keys = PUBLIC_AUDIT_DETAIL_KEYS[audit.eventType] ?? [];
    const details: Record<string, SecurityAuditDetail> = {};
    for (const key of keys) {
      const value = audit.metadata[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        details[key] = value;
      } else if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
        details[key] = [...value];
      }
    }
    return {
      id: audit.id,
      eventType: audit.eventType,
      actorUserId: audit.actorUserId,
      details,
      correlationId: audit.correlationId,
      occurredAt: audit.createdAt.toISOString(),
    };
  }

  private claimAvatarTransaction(
    userId: string,
    fileId: string,
    prepared: PreparedFileContent,
  ): Promise<AvatarClaimResult> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.repository.findByIdForUpdate(manager, userId);
      if (!user) throw new AppException('USER_NOT_FOUND');
      if (user.avatarFileId === fileId) {
        return { user, avatar: null, replacedFileId: null, idempotent: true } as const;
      }
      const avatar = await this.files.claimPrepared({
        manager,
        prepared,
        uploaderId: userId,
        purpose: 'user_avatar',
      });
      const replacedFileId = user.avatarFileId;
      if (replacedFileId) {
        await this.files.markDeletingForOwner(manager, replacedFileId, userId, 'user_avatar');
      }
      user.avatarFileId = fileId;
      const saved = await this.repository.saveWithAudit(
        manager,
        user,
        this.auditContext(userId, userId, 'user.avatar.changed', {
          action: 'replaced',
          hadPreviousAvatar: replacedFileId !== null,
        }),
      );
      await this.files.enqueueClaimCleanup(
        fileId,
        replacedFileId,
        this.requestContext.getCorrelationId() ?? 'unavailable',
        manager,
      );
      return { user: saved, avatar, replacedFileId, idempotent: false } as const;
    });
  }

  private async rolesForUser(userId: string): Promise<RoleDefinition[]> {
    return (await this.rolesByUserId([userId])).get(userId) ?? [];
  }

  private async rolesByUserId(userIds: readonly string[]): Promise<Map<string, RoleDefinition[]>> {
    const roleIdsByUser = await this.repository.roleIdsByUserIds(userIds);
    const allRoleIds = [...new Set([...roleIdsByUser.values()].flat())];
    const roles = await this.authorization.resolveRoles(allRoleIds);
    const rolesById = new Map(roles.map((role) => [role.id, role]));
    const result = new Map(
      userIds.map((userId) => [
        userId,
        (roleIdsByUser.get(userId) ?? []).flatMap((roleId) => {
          const role = rolesById.get(roleId);
          return role ? [role] : [];
        }),
      ]),
    );
    return this.authorization.applyUserOverridesForUsers(result);
  }

  private async responseFor(
    user: UserEntity,
    roles: readonly RoleDefinition[],
  ): Promise<UserResponseDto> {
    const avatar = user.avatarFileId
      ? ((await this.files.findPublicDescriptors([user.avatarFileId]))[0] ?? null)
      : null;
    return this.toResponse(user, roles, avatar);
  }

  private async avatarsByFileId(
    fileIds: readonly (string | null)[],
  ): Promise<Map<string, PublicFileDescriptor>> {
    const ids = [...new Set(fileIds.filter((id): id is string => id !== null))];
    return new Map(
      (await this.files.findPublicDescriptors(ids)).map((avatar) => [avatar.fileId, avatar]),
    );
  }

  private toResponse(
    user: UserEntity,
    roles: readonly RoleDefinition[],
    avatar: PublicFileDescriptor | null,
  ): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      emailTwoStepEnabled: user.emailTwoStepEnabled,
      emailTwoStepRequired: roles.some(({ key }) => key === 'admin' || key === 'super_admin'),
      roles: roles.map(({ key }) => key),
      avatar: avatar
        ? {
            fileId: avatar.fileId,
            url: avatar.url,
            mimeType: avatar.mimeType,
            size: avatar.sizeBytes,
          }
        : null,
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
      avatarFileId: user.avatarFileId,
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
