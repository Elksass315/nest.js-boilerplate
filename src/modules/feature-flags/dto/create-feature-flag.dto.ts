import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, Length, Matches } from 'class-validator';

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'checkout.new-flow', pattern: '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$' })
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
  public key!: string;

  @ApiProperty({ example: 'Enables the replacement checkout flow.', maxLength: 500 })
  @IsString()
  @Length(1, 500)
  public description!: string;

  @ApiProperty({ example: false, default: false })
  @IsBoolean()
  public enabled!: boolean;
}
