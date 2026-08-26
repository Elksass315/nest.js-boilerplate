import { ApiProperty } from '@nestjs/swagger';

import { PERMISSIONS, type Permission } from '@/modules/authorization';

export class UserPermissionsResponseDto {
  @ApiProperty({ enum: PERMISSIONS, isArray: true })
  public effective!: Permission[];

  @ApiProperty({ enum: PERMISSIONS, isArray: true })
  public grants!: Permission[];

  @ApiProperty({ enum: PERMISSIONS, isArray: true })
  public revokes!: Permission[];
}
