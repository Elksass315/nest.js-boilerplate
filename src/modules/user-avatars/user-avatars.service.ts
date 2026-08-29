import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { RequestContextService } from '@/core/request-context/request-context.service';
import { FilesService, type PreparedFileContent } from '@/modules/files';
import { UsersService, type UserProfileEnricher, type UserResponseDto } from '@/modules/users';

import { AvatarImageService } from './avatar-image.service';
import { UserAvatarsRepository } from './user-avatars.repository';

/**
 * Public avatar persistence boundary. Consumers do not need to know about the association entity
 * or the files provider. The capability owns its routes, response enrichment, and migration.
 */
@Injectable()
export class UserAvatarsService implements UserProfileEnricher {
  public constructor(
    private readonly repository: UserAvatarsRepository,
    private readonly files: FilesService,
    private readonly avatarImages: AvatarImageService,
    private readonly users: UsersService,
    private readonly requestContext: RequestContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  public async enrich(userIds: readonly string[]): Promise<Map<string, Record<string, unknown>>> {
    const associations = await this.repository.findByUserIds(this.dataSource.manager, userIds);
    const descriptors = await this.files.findPublicDescriptors(
      associations.map(({ fileId }) => fileId),
    );
    const descriptorsById = new Map(
      descriptors.map((descriptor) => [descriptor.fileId, descriptor]),
    );
    const fileIdByUserId = new Map(
      associations.map((association) => [association.userId, association.fileId]),
    );
    return new Map(
      userIds.map((userId) => {
        const fileId = fileIdByUserId.get(userId);
        const avatar = fileId ? descriptorsById.get(fileId) : undefined;
        return [
          userId,
          {
            avatar: avatar
              ? {
                  fileId: avatar.fileId,
                  url: avatar.url,
                  mimeType: avatar.mimeType,
                  size: avatar.sizeBytes,
                }
              : null,
          },
        ];
      }),
    );
  }

  public async replaceOwnAvatar(userId: string, fileId: string): Promise<UserResponseDto> {
    await this.users.getSelf(userId);
    if ((await this.findFileId(this.dataSource.manager, userId)) === fileId) {
      return this.users.getSelf(userId);
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
    try {
      const idempotent = await this.claim(userId, fileId, prepared);
      if (idempotent) await this.files.discardPrepared(prepared);
    } catch (error: unknown) {
      await this.files.discardPrepared(prepared);
      throw error;
    }
    return this.users.getSelf(userId);
  }

  public async deleteOwnAvatar(userId: string): Promise<void> {
    await this.users.getSelf(userId);
    await this.dataSource.transaction(async (manager) => {
      const fileId = await this.findFileId(manager, userId);
      if (!fileId) return;
      await this.files.markDeletingForOwner(manager, fileId, userId, 'user_avatar');
      await this.remove(manager, userId);
      await this.users.recordSecurityAudit(
        userId,
        'user.avatar.changed',
        { action: 'removed' },
        manager,
      );
      await this.files.scheduleDeletion(
        fileId,
        this.requestContext.getCorrelationId() ?? 'unavailable',
        manager,
      );
    });
  }

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

  private claim(userId: string, fileId: string, prepared: PreparedFileContent): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const replacedFileId = await this.findFileId(manager, userId);
      if (replacedFileId === fileId) return true;
      await this.files.claimPrepared({
        manager,
        prepared,
        uploaderId: userId,
        purpose: 'user_avatar',
      });
      if (replacedFileId) {
        await this.files.markDeletingForOwner(manager, replacedFileId, userId, 'user_avatar');
      }
      await this.attach(manager, userId, fileId);
      await this.users.recordSecurityAudit(
        userId,
        'user.avatar.changed',
        { action: 'replaced', hadPreviousAvatar: replacedFileId !== null },
        manager,
      );
      await this.files.enqueueClaimCleanup(
        fileId,
        replacedFileId,
        this.requestContext.getCorrelationId() ?? 'unavailable',
        manager,
      );
      return false;
    });
  }
}
