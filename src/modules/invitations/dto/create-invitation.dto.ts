import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { ROLE_KEYS, type RoleKey } from '@/modules/authorization';

export class CreateInvitationDto {
  @ApiProperty({ example: 'new.member@example.com', format: 'email', maxLength: 320 })
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  public email!: string;

  @ApiProperty({ enum: ROLE_KEYS, example: 'user' })
  @IsIn(ROLE_KEYS)
  public role!: RoleKey;
}
