import { ApiProperty } from '@nestjs/swagger';

export class FeatureFlagResponseDto {
  @ApiProperty({ example: '00adcbf5-0ee7-493d-a46a-0b1b108e14fc' }) public id!: string;
  @ApiProperty({ example: 'checkout.new-flow' }) public key!: string;
  @ApiProperty({ example: 'Enables the replacement checkout flow.' }) public description!: string;
  @ApiProperty({ example: false }) public enabled!: boolean;
  @ApiProperty({ example: 1 }) public version!: number;
  @ApiProperty({ example: '2026-08-19T12:00:00.000Z' }) public createdAt!: string;
  @ApiProperty({ example: '2026-08-19T12:00:00.000Z' }) public updatedAt!: string;
}
