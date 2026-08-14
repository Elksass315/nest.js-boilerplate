import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ example: 'b8f10c56-5e3c-42ee-8436-7994b9691ced', format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: '2026-08-12T10:00:00.000Z', format: 'date-time' })
  public createdAt!: string;

  @ApiProperty({ example: '2026-08-12T11:00:00.000Z', format: 'date-time' })
  public lastUsedAt!: string;

  @ApiProperty({ example: '2026-08-26T10:00:00.000Z', format: 'date-time' })
  public expiresAt!: string;

  @ApiProperty({ example: null, nullable: true, format: 'date-time' })
  public revokedAt!: string | null;
}
