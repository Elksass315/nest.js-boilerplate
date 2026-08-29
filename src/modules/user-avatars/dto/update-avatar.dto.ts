import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateAvatarDto {
  @ApiProperty({
    description: 'Completed user_avatar upload identifier returned by the tus creation response.',
    example: '4e951b98-9250-4414-b88c-33f184543d8c',
    format: 'uuid',
  })
  @IsUUID('4')
  public fileId!: string;
}
