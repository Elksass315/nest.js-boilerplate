import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PERMISSIONS, ROLE_KEYS, type Permission, type RoleKey } from '@/modules/authorization';
import type { UserStatus } from '@/modules/users';

import { TokenPairResponseDto } from './token-pair-response.dto';

const LOGIN_USER_STATUSES = ['pending_verification', 'active', 'suspended'] satisfies UserStatus[];

class LoginUserAvatarResponseDto {
  @ApiProperty({ example: '4e951b98-9250-4414-b88c-33f184543d8c', format: 'uuid' })
  public fileId!: string;

  @ApiProperty({
    example: 'http://localhost:3000/api/v1/files/public/67aa21ed-3e95-40cd-a2a1-67370da05d32',
  })
  public url!: string;

  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'], example: 'image/webp' })
  public mimeType!: string;

  @ApiProperty({ example: 148352, minimum: 1 })
  public size!: number;
}

export class LoginUserResponseDto {
  @ApiProperty({ example: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820', format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'Amina Hassan' })
  public fullName!: string;

  @ApiProperty({ example: 'amina@example.com', format: 'email' })
  public email!: string;

  @ApiProperty({ enum: LOGIN_USER_STATUSES, example: 'active' })
  public status!: UserStatus;

  @ApiPropertyOptional({ example: '2026-08-12T10:00:00.000Z', nullable: true })
  public emailVerifiedAt!: string | null;

  @ApiProperty({ example: false })
  public emailTwoStepEnabled!: boolean;

  @ApiProperty({ example: false })
  public emailTwoStepRequired!: boolean;

  @ApiProperty({ enum: ROLE_KEYS, isArray: true, example: ['user'] })
  public roles!: RoleKey[];

  @ApiProperty({ enum: PERMISSIONS, isArray: true, example: [] })
  public permissions!: Permission[];

  @ApiPropertyOptional({ type: LoginUserAvatarResponseDto, nullable: true })
  public avatar?: LoginUserAvatarResponseDto | null;

  @ApiProperty({ example: '2026-08-12T09:45:00.000Z' })
  public createdAt!: string;

  @ApiProperty({ example: '2026-08-12T10:05:00.000Z' })
  public updatedAt!: string;
}

export class LoginResponseDto extends TokenPairResponseDto {
  @ApiProperty({ type: LoginUserResponseDto })
  public user!: LoginUserResponseDto;
}
