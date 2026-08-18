import { ApiProperty } from '@nestjs/swagger';

import { ROLE_KEYS, type RoleKey } from '@/modules/authorization';

import { INVITATION_STATUSES, type InvitationStatus } from '../invitations.constants';

export class InvitationResponseDto {
  @ApiProperty({ example: '516f56de-a801-47ea-b178-6d64b55da325', format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'new.member@example.com', format: 'email' })
  public email!: string;

  @ApiProperty({ enum: ROLE_KEYS, example: 'user' })
  public role!: RoleKey;

  @ApiProperty({ enum: INVITATION_STATUSES, example: 'pending' })
  public status!: InvitationStatus;

  @ApiProperty({ example: '889e25cb-ded9-4eb8-a2d6-8f058cc96580', format: 'uuid' })
  public invitedByUserId!: string;

  @ApiProperty({ example: '2026-08-21T12:00:00.000Z', format: 'date-time' })
  public expiresAt!: string;

  @ApiProperty({ example: '2026-08-18T12:00:00.000Z', format: 'date-time' })
  public lastSentAt!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  public sendCount!: number;

  @ApiProperty({ example: '2026-08-18T12:00:00.000Z', format: 'date-time' })
  public createdAt!: string;

  @ApiProperty({ example: '2026-08-18T12:00:00.000Z', format: 'date-time' })
  public updatedAt!: string;
}
