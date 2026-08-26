import { ApiProperty } from '@nestjs/swagger';

export class SessionDeviceDto {
  @ApiProperty({ example: 'desktop', nullable: true })
  public type!: string | null;

  @ApiProperty({ example: 'Windows', nullable: true })
  public os!: string | null;

  @ApiProperty({ example: 'Chrome', nullable: true })
  public browser!: string | null;
}

export class SessionLocationDto {
  @ApiProperty({ example: 'EG', nullable: true })
  public country!: string | null;

  @ApiProperty({ example: 'Cairo', nullable: true })
  public region!: string | null;

  @ApiProperty({ example: 'Cairo', nullable: true })
  public city!: string | null;
}

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

  @ApiProperty({ example: '192.0.2.10', nullable: true })
  public ipAddress!: string | null;

  @ApiProperty({ example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', nullable: true })
  public userAgent!: string | null;

  @ApiProperty({ type: SessionDeviceDto, nullable: true })
  public device!: SessionDeviceDto | null;

  @ApiProperty({ type: SessionLocationDto, nullable: true })
  public location!: SessionLocationDto | null;
}
