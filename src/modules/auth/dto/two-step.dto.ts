import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class TwoStepActionRequestDto {
  @ApiProperty({ example: 'Correct-Horse-Battery-Staple-42' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  public currentPassword!: string;
}

export class TwoStepCodeConfirmationDto {
  @ApiProperty({ example: 'Y2hhbGxlbmdlLXRva2VuLWV4YW1wbGU' })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  public challengeToken!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  public code!: string;
}

export class LoginTwoStepEmailCodeDto extends TwoStepCodeConfirmationDto {
  @ApiProperty({ enum: ['email_code'], example: 'email_code' })
  @IsIn(['email_code'])
  public method!: 'email_code';
}

export class LoginTwoStepRecoveryCodeDto {
  @ApiProperty({ enum: ['recovery_code'], example: 'recovery_code' })
  @IsIn(['recovery_code'])
  public method!: 'recovery_code';

  @ApiProperty({ example: '7F3A-91BC-2D44-8E10' })
  @IsString()
  @Length(19, 19)
  public recoveryCode!: string;

  @ApiProperty({ example: 'Y2hhbGxlbmdlLXRva2VuLWV4YW1wbGU' })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  public challengeToken!: string;
}

export class CompleteLoginTwoStepDto {
  @ApiProperty({ enum: ['email_code', 'recovery_code'], example: 'email_code' })
  @IsIn(['email_code', 'recovery_code'])
  public method!: 'email_code' | 'recovery_code';

  @ApiProperty({ example: 'Y2hhbGxlbmdlLXRva2VuLWV4YW1wbGU' })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  public challengeToken!: string;

  @ApiProperty({ example: '482913', required: false })
  @ValidateIf((body: CompleteLoginTwoStepDto) => body.method === 'email_code')
  @IsString()
  @Length(6, 6)
  public code?: string;

  @ApiProperty({ example: '7F3A-91BC-2D44-8E10', required: false })
  @ValidateIf((body: CompleteLoginTwoStepDto) => body.method === 'recovery_code')
  @IsString()
  @Length(19, 19)
  public recoveryCode?: string;
}

export class TwoStepChallengeResponseDto {
  @ApiProperty({ example: true })
  public requiresTwoStep!: true;

  @ApiProperty({ example: 'Y2hhbGxlbmdlLXRva2VuLWV4YW1wbGU' })
  public challengeToken!: string;

  @ApiProperty({ example: 300 })
  public expiresIn!: number;
}

export class RecoveryCodesResponseDto {
  @ApiProperty({
    type: [String],
    example: ['7F3A-91BC-2D44-8E10', '19D2-77AB-4C03-5F91'],
    description: 'Shown once. Store these codes securely; the server retains only hashes.',
  })
  public recoveryCodes!: string[];
}
