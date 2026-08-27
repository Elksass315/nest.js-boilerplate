import { ApiProperty } from '@nestjs/swagger';

import { PERMISSIONS, type Permission } from '@/modules/authorization';

export class UserPermissionsResponseDto {
  @ApiProperty({ enum: PERMISSIONS, isArray: true, example: ['feature-flags.read', 'users.read'] })
  public effective!: Permission[];

  @ApiProperty({ enum: PERMISSIONS, isArray: true, example: ['feature-flags.read'] })
  public grants!: Permission[];

  @ApiProperty({ enum: PERMISSIONS, isArray: true, example: ['sessions.read.any'] })
  public revokes!: Permission[];
}
