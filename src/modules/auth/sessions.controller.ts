import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { API_VERSION } from '@/common/http/api-version.constants';
import { ApiOffsetPaginatedResponse, type OffsetPage } from '@/common/pagination';
import {
  CurrentPrincipal,
  RequireAuthenticated,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';

import { AuthService } from './auth.service';
import { errorContent, SESSIONS_PATH } from './auth.swagger';
import { SessionResponseDto } from './dto/session-response.dto';
import { SessionQueryDto } from './dto/session-query.dto';

@ApiTags('sessions')
@RequireAuthenticated()
@Controller({ path: 'sessions', version: API_VERSION })
export class SessionsController {
  public constructor(private readonly service: AuthService) {}

  @Get()
  @ApiOperation({
    summary: 'List own sessions',
    description:
      'Returns a bounded offset page of the authenticated user sessions. Use revoked=true or revoked=false to filter the page.',
  })
  @ApiOffsetPaginatedResponse(SessionResponseDto, 'The requested session page was returned.')
  @ApiUnauthorizedResponse({
    description: 'No valid access token was supplied.',
    content: errorContent('UNAUTHORIZED', SESSIONS_PATH),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page, limit, or revoked filter failed validation.',
    content: errorContent('VALIDATION_ERROR', SESSIONS_PATH, {
      fields: {
        page: ['page must not be less than 1'],
        revoked: ['revoked must be a boolean'],
      },
    }),
  })
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: SessionQueryDto,
  ): Promise<OffsetPage<SessionResponseDto>> {
    return this.service.listSessions(principal.userId, query.page, query.limit, query.revoked);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke one own session',
    description: 'Revokes the identified session only when it belongs to the authenticated user.',
  })
  @ApiNoContentResponse({
    description: 'The session was revoked.',
    content: { 'application/json': { example: null } },
  })
  @ApiUnauthorizedResponse({
    description: 'No valid access token was supplied.',
    content: errorContent('UNAUTHORIZED', `${SESSIONS_PATH}/b8f10c56-5e3c-42ee-8436-7994b9691ced`),
  })
  @ApiBadRequestResponse({
    description: 'The session identifier is not a UUID.',
    content: errorContent('BAD_REQUEST', `${SESSIONS_PATH}/not-a-uuid`),
  })
  @ApiNotFoundResponse({
    description: 'The session does not exist or belongs to another user.',
    content: errorContent(
      'SESSION_NOT_FOUND',
      `${SESSIONS_PATH}/b8f10c56-5e3c-42ee-8436-7994b9691ced`,
    ),
  })
  public revoke(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.service.revokeOwnedSession(principal.userId, id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke all own sessions',
    description:
      'Revokes every active session for the authenticated user, including the current one.',
  })
  @ApiNoContentResponse({
    description: 'All sessions were revoked.',
    content: { 'application/json': { example: null } },
  })
  @ApiUnauthorizedResponse({
    description: 'No valid access token was supplied.',
    content: errorContent('UNAUTHORIZED', SESSIONS_PATH),
  })
  public revokeAll(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<void> {
    return this.service.revokeAllSessions(principal.userId);
  }
}
