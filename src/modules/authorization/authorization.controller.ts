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

import { RequirePermissions } from './decorators/require-permissions.decorator';
import { RoleResponseDto } from './dto/role-response.dto';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthorizationService } from './authorization.service';

const errorContent = (
  statusCode: number,
  code: string,
  message: string,
  path: string,
  details?: Record<string, unknown>,
): Record<string, { example: Record<string, unknown> }> => ({
  'application/json': {
    example: {
      statusCode,
      code,
      message,
      timestamp: '2026-08-12T12:00:00.000Z',
      path,
      requestId: 'req_identity_example',
      correlationId: 'corr_identity_example',
      ...(details ? { details } : {}),
    },
  },
});

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
    content: errorContent(
      401,
      'UNAUTHORIZED',
      'Authentication is required',
      '/api/v1/authorization/roles',
    ),
  })
  @ApiForbiddenResponse({
    description: 'The principal does not have users.read.',
    content: errorContent(
      403,
      'FORBIDDEN',
      'You are not allowed to perform this action',
      '/api/v1/authorization/roles',
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: errorContent(
      422,
      'VALIDATION_ERROR',
      'Input validation failed',
      '/api/v1/authorization/roles',
      { fields: { page: ['page must not be less than 1'] } },
    ),
  })
  public list(@Query() query: OffsetPaginationQueryDto): Promise<OffsetPage<RoleResponseDto>> {
    return this.service.listRoles(query.page, query.limit);
  }
}
