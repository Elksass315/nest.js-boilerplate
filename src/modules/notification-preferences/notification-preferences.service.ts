import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppException } from '@/core/errors/app.exception';
import { UsersService } from '@/modules/users';
import { isPlainRecord } from '@/shared/helpers/is-plain-record';

import type { NotificationPreferencesResponseDto } from './dto/notification-preferences-response.dto';
import type { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import type { NotificationPreferencesEntity } from './entities/notification-preferences.entity';
import { NotificationPreferencesRepository } from './notification-preferences.repository';

export type OptionalEmailCategory = 'product_updates' | 'marketing';

@Injectable()
export class NotificationPreferencesService {
  public constructor(
    private readonly repository: NotificationPreferencesRepository,
    private readonly users: UsersService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  public async getForUser(userId: string): Promise<NotificationPreferencesResponseDto> {
    await this.users.getSelf(userId);
    return this.toResponse(await this.repository.findByUserId(userId));
  }

  public async isOptionalEmailEnabled(
    userId: string,
    category: OptionalEmailCategory,
  ): Promise<boolean> {
    const preferences = await this.repository.findByUserId(userId);
    if (!preferences) return false;
    return category === 'product_updates'
      ? preferences.productUpdatesEmail
      : preferences.marketingEmail;
  }

  public async update(
    userId: string,
    input: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponseDto> {
    await this.users.getSelf(userId);
    const preferences = await this.dataSource
      .transaction(async (manager) => {
        const current = await this.repository.findByUserIdForUpdate(manager, userId);
        if (!current) {
          if (input.expectedVersion !== 0) {
            throw new AppException('NOTIFICATION_PREFERENCES_VERSION_CONFLICT');
          }
          return this.repository.save(
            manager,
            this.repository.create(manager, {
              userId,
              productUpdatesEmail: input.productUpdatesEmail,
              marketingEmail: input.marketingEmail,
            }),
          );
        }
        if (current.version !== input.expectedVersion) {
          throw new AppException('NOTIFICATION_PREFERENCES_VERSION_CONFLICT');
        }
        if (
          current.productUpdatesEmail === input.productUpdatesEmail &&
          current.marketingEmail === input.marketingEmail
        ) {
          return current;
        }
        current.productUpdatesEmail = input.productUpdatesEmail;
        current.marketingEmail = input.marketingEmail;
        current.version += 1;
        return this.repository.save(manager, current);
      })
      .catch((error: unknown) => {
        if (isPlainRecord(error) && error['code'] === '23505') {
          throw new AppException('NOTIFICATION_PREFERENCES_VERSION_CONFLICT');
        }
        throw error;
      });
    return this.toResponse(preferences);
  }

  private toResponse(
    preferences: NotificationPreferencesEntity | null,
  ): NotificationPreferencesResponseDto {
    return {
      securityEmail: true,
      productUpdatesEmail: preferences?.productUpdatesEmail ?? false,
      marketingEmail: preferences?.marketingEmail ?? false,
      version: preferences?.version ?? 0,
      updatedAt: preferences?.updatedAt.toISOString() ?? null,
    };
  }
}
