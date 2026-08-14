import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_CURSOR_LENGTH, MAX_LIMIT } from './pagination.constants';

export class OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: DEFAULT_PAGE, default: DEFAULT_PAGE, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    example: DEFAULT_LIMIT,
    default: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  @IsOptional()
  public limit: number = DEFAULT_LIMIT;
}

export class CursorPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous page.',
    example:
      'eyJ2IjoxLCJzIjoiMjAyNi0wOC0xMlQxMjozMDowMC4wMDBaIiwiaSI6IjAxMjM0NTY3LTg5YWItNGNkZS04ZjAxLTIzNDU2Nzg5YWJjZCJ9',
  })
  @IsString()
  @MaxLength(MAX_CURSOR_LENGTH)
  @IsOptional()
  public cursor?: string;

  @ApiPropertyOptional({
    example: DEFAULT_LIMIT,
    default: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  @IsOptional()
  public limit: number = DEFAULT_LIMIT;
}
