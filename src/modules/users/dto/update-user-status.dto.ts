import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { USER_STATUSES, type UserStatus } from '../users.constants';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: USER_STATUSES, example: 'suspended' })
  @IsIn(USER_STATUSES)
  public status!: UserStatus;
}
