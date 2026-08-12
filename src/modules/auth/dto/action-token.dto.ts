import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ActionTokenDto {
  @ApiProperty({
    example: 'Y2hhbmdlLW1lLXJhbmRvbS10b2tlbi0xMjM0NTY3ODkw',
    minLength: 40,
    maxLength: 64,
  })
  @IsString()
  @Length(40, 64)
  public token!: string;
}
