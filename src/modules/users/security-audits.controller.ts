import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import {
  CurrentPrincipal,
  RequireAuthenticated,
  RequirePermissions,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';

import { SecurityAuditResponseDto } from './dto/security-audit-response.dto';
import { UsersService } from './users.service';

const path = '/api/v1/users';
const userId = '7b3f8ed4-73ef-4afe-8703-b10dd32f3820';
const auditPageExample = {
  items: [
    {
      id: 'a68c1d2a-e244-4d3a-a64f-054763e23f85',
      eventType: 'auth.login.failed',
      actorUserId: userId,
      details: { failedLoginCount: 2, locked: false },
      correlationId: 'corr_security_center_example',
      occurredAt: '2026-08-18T12:00:00.000Z',
    },
  ],
  meta: {
    page: 1,
    limit: 20,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};
const errorContent = (
  code: ErrorCode,
  route: string,
): Record<string, { example: Record<string, unknown> }> => swaggerErrorContent(code, route);

@ApiTags('users')
@Controller({ path: 'users', version: API_VERSION })
export class SecurityAuditsController {
  public constructor(private readonly service: UsersService) {}

  @Get('me/security-audits')
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'List personal security history',
    description:
      'Returns the authenticated user security history with allowlisted details, newest first.',
  })
  @ApiOffsetPaginatedResponse(
    SecurityAuditResponseDto,
    'The personal security-audit page was returned.',
    auditPageExample,
  )
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED', `${path}/me/security-audits`),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: errorContent('VALIDATION_ERROR', `${path}/me/security-audits?page=0`),
  })
  public listOwn(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: OffsetPaginationQueryDto,
  ): Promise<OffsetPage<SecurityAuditResponseDto>> {
    return this.service.listOwnSecurityAudits(principal.userId, query.page, query.limit);
  }

  @Get(':id/security-audits')
  @RequirePermissions('users.security-audits.read.any')
  @ApiOperation({
    summary: 'List a user security history',
    description:
      'Returns one user security history for a super administrator with allowlisted details, newest first.',
  })
  @ApiOffsetPaginatedResponse(
    SecurityAuditResponseDto,
    'The requested user security-audit page was returned.',
    auditPageExample,
  )
  @ApiBadRequestResponse({
    description: 'The path identifier is not a UUID.',
    content: errorContent('BAD_REQUEST', `${path}/not-a-uuid/security-audits`),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED', `${path}/${userId}/security-audits`),
  })
  @ApiForbiddenResponse({
    description: 'The principal does not have users.security-audits.read.any.',
    content: errorContent('FORBIDDEN', `${path}/${userId}/security-audits`),
  })
  @ApiNotFoundResponse({
    description: 'No user exists with the supplied identifier.',
    content: errorContent('USER_NOT_FOUND', `${path}/${userId}/security-audits`),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: errorContent('VALIDATION_ERROR', `${path}/${userId}/security-audits?limit=101`),
  })
  public listForUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: OffsetPaginationQueryDto,
  ): Promise<OffsetPage<SecurityAuditResponseDto>> {
    return this.service.listUserSecurityAudits(id, query.page, query.limit);
  }
}
