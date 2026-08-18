import { ApiProperty } from '@nestjs/swagger';

import { SECURITY_AUDIT_EVENTS, type SecurityAuditEvent } from '../users.constants';

export type SecurityAuditDetail = string | number | boolean | string[];

export class SecurityAuditResponseDto {
  @ApiProperty({ format: 'uuid', example: 'a68c1d2a-e244-4d3a-a64f-054763e23f85' })
  public id!: string;

  @ApiProperty({ enum: SECURITY_AUDIT_EVENTS, example: 'auth.login.succeeded' })
  public eventType!: SecurityAuditEvent;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    example: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    description: 'The acting user when the event was user-initiated; null for system actions.',
  })
  public actorUserId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { failedLoginCount: 2, locked: false },
    description: 'An allowlisted, event-specific subset of non-sensitive audit details.',
  })
  public details!: Record<string, SecurityAuditDetail>;

  @ApiProperty({
    nullable: true,
    example: 'corr_security_center_example',
    description: 'Correlation identifier retained across related requests and background work.',
  })
  public correlationId!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-08-18T12:00:00.000Z' })
  public occurredAt!: string;
}
