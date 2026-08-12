import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'cmVmcmVzaC10b2tlbi1leGFtcGxlLTEyMzQ1Njc4OTA',
    minLength: 40,
    maxLength: 64,
  })
  @IsString()
  @Length(40, 64)
  public refreshToken!: string;
}
