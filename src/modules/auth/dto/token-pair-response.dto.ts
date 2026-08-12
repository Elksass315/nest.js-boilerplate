import { ApiProperty } from '@nestjs/swagger';

export class TokenPairResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.signature' })
  public accessToken!: string;

  @ApiProperty({ example: 'cmVmcmVzaC10b2tlbi1leGFtcGxlLTEyMzQ1Njc4OTA' })
  public refreshToken!: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  public tokenType!: 'Bearer';

  @ApiProperty({ example: 900 })
  public expiresIn!: number;
}
