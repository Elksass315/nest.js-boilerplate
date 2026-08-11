import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OffsetPageMetaDto {
  @ApiProperty({ example: 1 })
  public page!: number;

  @ApiProperty({ example: 20 })
  public limit!: number;

  @ApiProperty({ example: 42 })
  public totalItems!: number;

  @ApiProperty({ example: 3 })
  public totalPages!: number;

  @ApiProperty({ example: true })
  public hasNextPage!: boolean;

  @ApiProperty({ example: false })
  public hasPreviousPage!: boolean;
}

export class CursorPageMetaDto {
  @ApiPropertyOptional({
    nullable: true,
    example:
      'eyJ2IjoxLCJzIjoiMjAyNi0wOC0xMlQxMjozMDowMC4wMDBaIiwiaSI6IjAxMjM0NTY3LTg5YWItNGNkZS04ZjAxLTIzNDU2Nzg5YWJjZCJ9',
  })
  public nextCursor!: string | null;

  @ApiProperty({ example: true })
  public hasNextPage!: boolean;

  @ApiProperty({ example: 20 })
  public limit!: number;
}
