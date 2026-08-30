import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class RegistrationIdentifierDto {
  @ApiProperty({ example: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820', format: 'uuid' })
  @IsUUID('4')
  public registrationId!: string;
}

export class ConfirmEmailVerificationDto extends RegistrationIdentifierDto {
  @ApiProperty({ example: '482913', pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  public code!: string;
}

export class RegistrationResponseDto {
  @ApiProperty({ example: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820', format: 'uuid' })
  public registrationId!: string;

  @ApiProperty({ example: 600 })
  public verificationExpiresIn!: number;

  @ApiProperty({ example: 'Registration accepted; enter the code sent to your email' })
  public message!: string;
}

export class VerificationResendResponseDto {
  @ApiProperty({ example: 600 })
  public verificationExpiresIn!: number;

  @ApiProperty({ example: 'If the registration is eligible, a verification code will be sent' })
  public message!: string;
}
