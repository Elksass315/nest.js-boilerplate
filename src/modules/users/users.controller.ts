import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
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
import {
  CurrentPrincipal,
  PermissionsGuard,
  RequireAuthenticated,
  RequirePermissions,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';

import { ReplaceUserRolesDto } from './dto/replace-user-roles.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

const path = '/api/v1/users';
const errorContent = (
  statusCode: number,
  code: string,
  message: string,
  route = path,
  details?: Record<string, unknown>,
): Record<string, { example: Record<string, unknown> }> => ({
  'application/json': {
    example: {
      statusCode,
      code,
      message,
      timestamp: '2026-08-12T12:00:00.000Z',
      path: route,
      requestId: 'req_identity_example',
      correlationId: 'corr_identity_example',
      ...(details ? { details } : {}),
    },
  },
});
const userContent = {
  'application/json': {
    example: {
      id: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
      fullName: 'Amina Hassan',
      email: 'amina@example.com',
      status: 'active',
      emailVerifiedAt: '2026-08-12T10:00:00.000Z',
      emailTwoStepEnabled: false,
      roles: ['user'],
      createdAt: '2026-08-12T09:45:00.000Z',
      updatedAt: '2026-08-12T10:05:00.000Z',
    },
  },
};

@ApiTags('users')
@UseGuards(PermissionsGuard)
@Controller({ path: 'users', version: API_VERSION })
export class UsersController {
  public constructor(private readonly service: UsersService) {}

  @Get('me')
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Get the current user profile',
    description: 'Returns the authenticated account without credential or lockout fields.',
  })
  @ApiOkResponse({ description: 'The current profile was returned.', content: userContent })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required', `${path}/me`),
  })
  public getMe(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<UserResponseDto> {
    return this.service.getSelf(principal.userId);
  }

  @Patch('me')
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Update the current user profile',
    description:
      'Updates the authenticated user full name and records a correlated security audit.',
  })
  @ApiOkResponse({ description: 'The profile was updated.', content: userContent })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required', `${path}/me`),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The full name failed validation.',
    content: errorContent(422, 'VALIDATION_ERROR', 'Input validation failed', `${path}/me`, {
      fields: { fullName: ['fullName must be longer than or equal to 2 characters'] },
    }),
  })
  public updateMe(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.service.updateOwnProfile(principal.userId, body.fullName);
  }

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({
    summary: 'List user accounts',
    description: 'Returns a bounded offset page of user accounts ordered by newest first.',
  })
  @ApiOffsetPaginatedResponse(UserResponseDto, 'The requested user page was returned.')
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'The principal does not have users.read.',
    content: errorContent(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: errorContent(422, 'VALIDATION_ERROR', 'Input validation failed', path, {
      fields: { page: ['page must not be less than 1'] },
    }),
  })
  public list(@Query() query: OffsetPaginationQueryDto): Promise<OffsetPage<UserResponseDto>> {
    return this.service.list(query.page, query.limit);
  }

  @Get(':id')
  @RequirePermissions('users.read')
  @ApiOperation({
    summary: 'Get a user account',
    description:
      'Returns one account by UUID without exposing its password hash or lockout counters.',
  })
  @ApiOkResponse({ description: 'The user account was returned.', content: userContent })
  @ApiBadRequestResponse({
    description: 'The path identifier is not a UUID.',
    content: errorContent(
      400,
      'BAD_REQUEST',
      'The request could not be processed',
      `${path}/not-a-uuid`,
    ),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(
      401,
      'UNAUTHORIZED',
      'Authentication is required',
      `${path}/7b3f8ed4-73ef-4afe-8703-b10dd32f3820`,
    ),
  })
  @ApiForbiddenResponse({
    description: 'The principal does not have users.read.',
    content: errorContent(
      403,
      'FORBIDDEN',
      'You are not allowed to perform this action',
      `${path}/7b3f8ed4-73ef-4afe-8703-b10dd32f3820`,
    ),
  })
  @ApiNotFoundResponse({
    description: 'No user exists with the supplied identifier.',
    content: errorContent(
      404,
      'USER_NOT_FOUND',
      'The requested user was not found',
      `${path}/7b3f8ed4-73ef-4afe-8703-b10dd32f3820`,
    ),
  })
  public getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserResponseDto> {
    return this.service.getById(id);
  }

  @Patch(':id/status')
  @RequirePermissions('users.status.manage')
  @ApiOperation({
    summary: 'Change a user status',
    description:
      'Changes account status, increments authVersion, audits the action, and protects the last active super administrator.',
  })
  @ApiOkResponse({ description: 'The user status was changed.', content: userContent })
  @ApiBadRequestResponse({
    description: 'The path identifier is not a UUID.',
    content: errorContent(400, 'BAD_REQUEST', 'The request could not be processed'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot manage user status.',
    content: errorContent(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiNotFoundResponse({
    description: 'The target user does not exist.',
    content: errorContent(404, 'USER_NOT_FOUND', 'The requested user was not found'),
  })
  @ApiConflictResponse({
    description: 'The change would remove the last active super administrator.',
    content: errorContent(
      409,
      'LAST_SUPER_ADMIN',
      'At least one active super administrator must remain',
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The requested status failed validation.',
    content: errorContent(422, 'VALIDATION_ERROR', 'Input validation failed', path, {
      fields: {
        status: [
          'status must be one of the following values: pending_verification, active, suspended',
        ],
      },
    }),
  })
  public updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateUserStatusDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<UserResponseDto> {
    return this.service.updateStatus(id, body.status, principal.userId);
  }

  @Put(':id/roles')
  @RequirePermissions('users.roles.manage')
  @ApiOperation({
    summary: 'Replace a user role set',
    description:
      'Atomically replaces fixed role assignments, increments authVersion, and protects the last active super administrator.',
  })
  @ApiOkResponse({ description: 'The user role assignments were replaced.', content: userContent })
  @ApiBadRequestResponse({
    description: 'The path identifier is not a UUID.',
    content: errorContent(400, 'BAD_REQUEST', 'The request could not be processed'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot manage user roles.',
    content: errorContent(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiNotFoundResponse({
    description: 'The target user or a requested role does not exist.',
    content: {
      'application/json': {
        examples: {
          userNotFound: {
            summary: 'The target user does not exist',
            value: errorContent(404, 'USER_NOT_FOUND', 'The requested user was not found')[
              'application/json'
            ]?.example,
          },
          roleNotFound: {
            summary: 'At least one requested role does not exist',
            value: errorContent(
              404,
              'ROLE_NOT_FOUND',
              'One or more requested roles were not found',
            )['application/json']?.example,
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'The change would remove the last active super administrator.',
    content: errorContent(
      409,
      'LAST_SUPER_ADMIN',
      'At least one active super administrator must remain',
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The role identifier set failed validation.',
    content: errorContent(422, 'VALIDATION_ERROR', 'Input validation failed', path, {
      fields: { roleIds: ['each value in roleIds must be a UUID'] },
    }),
  })
  public replaceRoles(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ReplaceUserRolesDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<UserResponseDto> {
    return this.service.replaceRoles(id, body.roleIds, principal.userId);
  }
}
