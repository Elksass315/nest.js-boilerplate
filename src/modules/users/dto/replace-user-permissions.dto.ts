import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';

import { PERMISSIONS, type Permission } from '@/modules/authorization';

export class ReplaceUserPermissionsDto {
  @ApiProperty({ enum: PERMISSIONS, isArray: true, example: ['feature-flags.read'] })
  @IsArray()
  @ArrayUnique()
  @IsEnum(PERMISSIONS, { each: true })
  public grants!: Permission[];

  @ApiProperty({ enum: PERMISSIONS, isArray: true, example: ['sessions.read.any'] })
  @IsArray()
  @ArrayUnique()
  @IsEnum(PERMISSIONS, { each: true })
  public revokes!: Permission[];
}
