import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Amina Hassan', minLength: 2, maxLength: 160 })
  @IsString()
  @Length(2, 160)
  public fullName!: string;

  @ApiProperty({ example: 'amina@example.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  public email!: string;

  @ApiProperty({ example: 'Correct-Horse-Battery-2026!', minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  public password!: string;
}
