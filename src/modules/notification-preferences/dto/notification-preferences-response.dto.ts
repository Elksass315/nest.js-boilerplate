import { ApiProperty } from '@nestjs/swagger';

export class NotificationPreferencesResponseDto {
  @ApiProperty({
    example: true,
    readOnly: true,
    description: 'Mandatory account-protection email.',
  })
  public securityEmail!: true;

  @ApiProperty({ example: false })
  public productUpdatesEmail!: boolean;

  @ApiProperty({ example: false })
  public marketingEmail!: boolean;

  @ApiProperty({ example: 0, description: 'Zero means the user still has default preferences.' })
  public version!: number;

  @ApiProperty({ example: null, nullable: true })
  public updatedAt!: string | null;
}
