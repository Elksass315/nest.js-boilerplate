import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateFeatureFlagDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  public enabled!: boolean;

  @ApiProperty({ example: 1, minimum: 1, description: 'Version returned by the latest read.' })
  @IsInt()
  @Min(1)
  public expectedVersion!: number;
}
