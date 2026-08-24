import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class FeatureFlagKeyParamsDto {
  @ApiProperty({ example: 'checkout.new-flow', pattern: '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$' })
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
  public key!: string;
}
