import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { API_VERSION } from '@/common/http/api-version.constants';
import {
  ApiOffsetPaginatedResponse,
  OffsetPaginationQueryDto,
  type OffsetPage,
} from '@/common/pagination';
import { swaggerErrorContent } from '@/common/swagger/api-error-response';
import type { ErrorCode } from '@/core/errors/error-definitions';

import { RequirePermissions } from './decorators/require-permissions.decorator';
import { RoleResponseDto } from './dto/role-response.dto';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthorizationService } from './authorization.service';

const errorContent = (
  code: ErrorCode,
  path: string,
  details?: Record<string, unknown>,
): Record<string, { example: Record<string, unknown> }> => swaggerErrorContent(code, path, details);

@ApiTags('authorization')
@UseGuards(PermissionsGuard)
@Controller({ path: 'authorization/roles', version: API_VERSION })
export class AuthorizationController {
  public constructor(private readonly service: AuthorizationService) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({
    summary: 'List fixed authorization roles',
    description: 'Returns the immutable system role definitions and their effective permissions.',
  })
  @ApiOffsetPaginatedResponse(RoleResponseDto, 'Fixed authorization roles were returned.')
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED', '/api/v1/authorization/roles'),
  })
  @ApiForbiddenResponse({
    description: 'The principal does not have users.read.',
    content: errorContent('FORBIDDEN', '/api/v1/authorization/roles'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: errorContent('VALIDATION_ERROR', '/api/v1/authorization/roles', {
      fields: { page: ['page must not be less than 1'] },
    }),
  })
  public list(@Query() query: OffsetPaginationQueryDto): Promise<OffsetPage<RoleResponseDto>> {
    return this.service.listRoles(query.page, query.limit);
  }
}
