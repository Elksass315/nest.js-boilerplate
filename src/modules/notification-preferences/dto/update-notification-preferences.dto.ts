import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  public productUpdatesEmail!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  public marketingEmail!: boolean;

  @ApiProperty({ example: 0, minimum: 0, description: 'Version returned by the latest GET.' })
  @IsInt()
  @Min(0)
  public expectedVersion!: number;
}
