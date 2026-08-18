import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({
    example: 'invitation-token-from-email-link-0000000000',
    minLength: 43,
    maxLength: 43,
  })
  @IsString()
  @Length(43, 43)
  @Matches(/^[A-Za-z0-9_-]+$/)
  public token!: string;

  @ApiProperty({ example: 'Amina Hassan', minLength: 2, maxLength: 160 })
  @IsString()
  @Length(2, 160)
  public fullName!: string;

  @ApiProperty({ example: 'Correct-Horse-Battery-2026!', minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  public password!: string;
}
