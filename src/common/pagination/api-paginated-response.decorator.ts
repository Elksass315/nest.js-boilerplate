import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { CursorPageMetaDto, OffsetPageMetaDto } from './pagination.dto';

export function ApiOffsetPaginatedResponse(
  model: Type<unknown>,
  description: string,
  example?: Record<string, unknown>,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(model, OffsetPageMetaDto),
    ApiOkResponse({
      description,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['items', 'meta'],
            properties: {
              items: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: { $ref: getSchemaPath(OffsetPageMetaDto) },
            },
          },
          ...(example ? { example } : {}),
        },
      },
    }),
  );
}

export function ApiCursorPaginatedResponse(
  model: Type<unknown>,
  description: string,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(model, CursorPageMetaDto),
    ApiOkResponse({
      description,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['items', 'nextCursor', 'hasNextPage', 'limit'],
            properties: {
              items: { type: 'array', items: { $ref: getSchemaPath(model) } },
              nextCursor: { type: 'string', nullable: true },
              hasNextPage: { type: 'boolean' },
              limit: { type: 'integer' },
            },
          },
        },
      },
    }),
  );
}
