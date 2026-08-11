import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ROLE_KEYS, type RoleKey } from '@/modules/authorization';

import { USER_STATUSES, type UserStatus } from '../users.constants';

export class UserResponseDto {
  @ApiProperty({ example: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820', format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'Amina Hassan' })
  public fullName!: string;

  @ApiProperty({ example: 'amina@example.com', format: 'email' })
  public email!: string;

  @ApiProperty({ enum: USER_STATUSES, example: 'active' })
  public status!: UserStatus;

  @ApiPropertyOptional({ example: '2026-08-12T10:00:00.000Z', nullable: true })
  public emailVerifiedAt!: string | null;

  @ApiProperty({ example: false })
  public emailTwoStepEnabled!: boolean;

  @ApiProperty({ enum: ROLE_KEYS, isArray: true, example: ['user'] })
  public roles!: RoleKey[];

  @ApiProperty({ example: '2026-08-12T09:45:00.000Z' })
  public createdAt!: string;

  @ApiProperty({ example: '2026-08-12T10:05:00.000Z' })
  public updatedAt!: string;
}
