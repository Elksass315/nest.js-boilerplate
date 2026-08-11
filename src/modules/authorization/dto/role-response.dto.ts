import { ApiProperty } from '@nestjs/swagger';

import { PERMISSIONS, ROLE_KEYS, type Permission, type RoleKey } from '../authorization.constants';

export class RoleResponseDto {
  @ApiProperty({ example: '2f25df1c-5ef9-4a67-b6e3-51e91b47a208', format: 'uuid' })
  public id!: string;

  @ApiProperty({ enum: ROLE_KEYS, example: 'admin' })
  public key!: RoleKey;

  @ApiProperty({ example: 'Administrator' })
  public name!: string;

  @ApiProperty({ example: 'Can inspect user accounts without changing security state.' })
  public description!: string;

  @ApiProperty({ enum: PERMISSIONS, isArray: true, example: ['users.read'] })
  public permissions!: Permission[];
}
