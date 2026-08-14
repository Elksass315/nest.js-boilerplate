import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsUUID } from 'class-validator';

export class ReplaceUserRolesDto {
  @ApiProperty({
    example: ['2f25df1c-5ef9-4a67-b6e3-51e91b47a208'],
    description: 'Complete replacement set of persisted role identifiers.',
    isArray: true,
    format: 'uuid',
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  public roleIds!: string[];
}
