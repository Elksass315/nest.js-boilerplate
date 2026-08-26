import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { OffsetPaginationQueryDto } from '@/common/pagination';

function parseBooleanQuery(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class SessionQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter sessions by whether they have been revoked.',
    example: false,
  })
  @Transform(({ value }) => parseBooleanQuery(value))
  @IsBoolean()
  @IsOptional()
  public revoked?: boolean;
}
