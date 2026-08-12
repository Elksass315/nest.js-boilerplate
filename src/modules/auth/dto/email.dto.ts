import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class EmailDto {
  @ApiProperty({ example: 'amina@example.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  public email!: string;
}
