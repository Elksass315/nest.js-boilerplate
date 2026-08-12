import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'Y2hhbmdlLW1lLXJhbmRvbS10b2tlbi0xMjM0NTY3ODkw',
    minLength: 40,
    maxLength: 64,
  })
  @IsString()
  @Length(40, 64)
  public token!: string;

  @ApiProperty({ example: 'New-Correct-Horse-Battery-2026!', minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  public newPassword!: string;
}
