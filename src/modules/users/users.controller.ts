import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  ApiUnsupportedMediaTypeResponse,
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

import { ReplaceUserRolesDto } from './dto/replace-user-roles.dto';
import { ReplaceUserPermissionsDto } from './dto/replace-user-permissions.dto';
import { UserPermissionsResponseDto } from './dto/user-permissions-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

const path = '/api/v1/users';
const errorContent = (
  code: ErrorCode,
  route = path,
  details?: Record<string, unknown>,
): Record<string, { example: Record<string, unknown> }> =>
  swaggerErrorContent(code, route, details);
const userContent = {
  'application/json': {
    example: {
      id: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
      fullName: 'Amina Hassan',
      email: 'amina@example.com',
      status: 'active',
      emailVerifiedAt: '2026-08-12T10:00:00.000Z',
      emailTwoStepEnabled: false,
      emailTwoStepRequired: false,
      roles: ['user'],
      avatar: {
        fileId: '4e951b98-9250-4414-b88c-33f184543d8c',
        url: 'http://localhost:3000/api/v1/files/public/67aa21ed-3e95-40cd-a2a1-67370da05d32',
        mimeType: 'image/webp',
        size: 148352,
      },
      createdAt: '2026-08-12T09:45:00.000Z',
      updatedAt: '2026-08-12T10:05:00.000Z',
    },
  },
};
const permissionContent = {
  'application/json': {
    example: {
      effective: ['users.read', 'feature-flags.read'],
      grants: ['feature-flags.read'],
      revokes: ['sessions.read.any'],
    },
  },
};

@ApiTags('users')
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
    content: errorContent('UNAUTHORIZED', `${path}/me`),
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
    content: errorContent('UNAUTHORIZED', `${path}/me`),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The full name failed validation.',
    content: errorContent('VALIDATION_ERROR', `${path}/me`, {
      fields: { fullName: ['fullName must be longer than or equal to 2 characters'] },
    }),
  })
  public updateMe(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.service.updateOwnProfile(principal.userId, body.fullName);
  }

  @Patch('me/avatar')
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Set the current user avatar',
    description:
      'Validates and sanitizes a completed owned upload, atomically attaches it, and schedules replaced bytes for correlated cleanup.',
  })
  @ApiOkResponse({ description: 'The sanitized avatar was attached.', content: userContent })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED', `${path}/me/avatar`),
  })
  @ApiForbiddenResponse({
    description: 'The upload belongs to another user.',
    content: errorContent('FILE_OWNERSHIP_MISMATCH', `${path}/me/avatar`),
  })
  @ApiNotFoundResponse({
    description: 'The user or upload no longer exists.',
    content: {
      'application/json': {
        examples: {
          fileNotFound: {
            summary: 'The upload does not exist',
            value: errorContent('FILE_NOT_FOUND', `${path}/me/avatar`)['application/json']?.example,
          },
          userNotFound: {
            summary: 'The authenticated user no longer exists',
            value: errorContent('USER_NOT_FOUND', `${path}/me/avatar`)['application/json']?.example,
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'The upload has not completed or cannot be claimed.',
    content: errorContent('FILE_NOT_READY', `${path}/me/avatar`),
  })
  @ApiGoneResponse({
    description: 'The completed upload expired before it was claimed.',
    content: errorContent('FILE_UPLOAD_EXPIRED', `${path}/me/avatar`),
  })
  @ApiPayloadTooLargeResponse({
    description: 'The source exceeds the configured avatar byte limit.',
    content: errorContent('FILE_TOO_LARGE', `${path}/me/avatar`),
  })
  @ApiUnsupportedMediaTypeResponse({
    description:
      'The declaration, extension, or detected format is not an allowed matching JPEG, PNG, or WebP image.',
    content: errorContent('FILE_TYPE_NOT_ALLOWED', `${path}/me/avatar`),
  })
  @ApiUnprocessableEntityResponse({
    description:
      'The file ID is invalid or the image is animated, malformed, oversized in dimensions, or unsafe to decode.',
    content: {
      'application/json': {
        examples: {
          invalidFileId: {
            summary: 'The file identifier is not a UUID',
            value: errorContent('VALIDATION_ERROR', `${path}/me/avatar`, {
              fields: { fileId: ['fileId must be a UUID'] },
            })['application/json']?.example,
          },
          invalidImage: {
            summary: 'The image cannot be safely processed',
            value: errorContent('FILE_INVALID_IMAGE', `${path}/me/avatar`)['application/json']
              ?.example,
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Storage could not read the upload or persist the sanitized result.',
    content: errorContent('FILE_STORAGE_UNAVAILABLE', `${path}/me/avatar`),
  })
  public replaceAvatar(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: UpdateAvatarDto,
  ): Promise<UserResponseDto> {
    return this.service.replaceOwnAvatar(principal.userId, body.fileId);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Remove the current user avatar',
    description:
      'Atomically detaches the avatar and schedules its bytes for idempotent correlated cleanup.',
  })
  @ApiNoContentResponse({
    description: 'The avatar was detached, or the user already had no avatar.',
    content: { 'application/json': { example: null } },
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED', `${path}/me/avatar`),
  })
  @ApiNotFoundResponse({
    description: 'The authenticated user no longer exists.',
    content: errorContent('USER_NOT_FOUND', `${path}/me/avatar`),
  })
  public deleteAvatar(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<void> {
    return this.service.deleteOwnAvatar(principal.userId);
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
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal does not have users.read.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: errorContent('VALIDATION_ERROR', path, {
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
    content: errorContent('BAD_REQUEST', `${path}/not-a-uuid`),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED', `${path}/7b3f8ed4-73ef-4afe-8703-b10dd32f3820`),
  })
  @ApiForbiddenResponse({
    description: 'The principal does not have users.read.',
    content: errorContent('FORBIDDEN', `${path}/7b3f8ed4-73ef-4afe-8703-b10dd32f3820`),
  })
  @ApiNotFoundResponse({
    description: 'No user exists with the supplied identifier.',
    content: errorContent('USER_NOT_FOUND', `${path}/7b3f8ed4-73ef-4afe-8703-b10dd32f3820`),
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
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot manage user status.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiNotFoundResponse({
    description: 'The target user does not exist.',
    content: errorContent('USER_NOT_FOUND'),
  })
  @ApiConflictResponse({
    description: 'The change would remove the last active super administrator.',
    content: errorContent('LAST_SUPER_ADMIN'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The requested status failed validation.',
    content: errorContent('VALIDATION_ERROR', path, {
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
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot manage user roles.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiNotFoundResponse({
    description: 'The target user or a requested role does not exist.',
    content: {
      'application/json': {
        examples: {
          userNotFound: {
            summary: 'The target user does not exist',
            value: errorContent('USER_NOT_FOUND')['application/json']?.example,
          },
          roleNotFound: {
            summary: 'At least one requested role does not exist',
            value: errorContent('ROLE_NOT_FOUND')['application/json']?.example,
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'The change would remove the last active super administrator.',
    content: errorContent('LAST_SUPER_ADMIN'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The role identifier set failed validation.',
    content: errorContent('VALIDATION_ERROR', path, {
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

  @Get(':id/permissions')
  @RequirePermissions('users.permissions.manage')
  @ApiOperation({
    summary: 'Get a user permission override set',
    description: 'Returns inherited and explicit permission state.',
  })
  @ApiOkResponse({
    type: UserPermissionsResponseDto,
    description: 'Permission overrides returned.',
    content: permissionContent,
  })
  @ApiBadRequestResponse({
    description: 'The target user identifier is not a UUID.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal does not have users.permissions.manage.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiNotFoundResponse({
    description: 'The target user does not exist.',
    content: errorContent('USER_NOT_FOUND'),
  })
  public getPermissions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserPermissionsResponseDto> {
    return this.service.getPermissionOverrides(id);
  }

  @Put(':id/permissions')
  @RequirePermissions('users.permissions.manage')
  @ApiOperation({
    summary: 'Replace a user permission override set',
    description:
      'Replaces explicit grants and revokes while preserving role inheritance. The actor must both hold users.permissions.manage and have an actual super_admin role. Protected administration permissions and super-admin targets cannot be changed.',
  })
  @ApiBody({ type: ReplaceUserPermissionsDto })
  @ApiOkResponse({
    type: UserPermissionsResponseDto,
    description: 'Permission overrides replaced.',
    content: permissionContent,
  })
  @ApiBadRequestResponse({
    description: 'The target user identifier is not a UUID.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description:
      'The actor lacks the real super-admin role, a protected grant was requested, or the target is a super administrator.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiNotFoundResponse({
    description: 'The target user or a catalog permission does not exist.',
    content: {
      'application/json': {
        examples: {
          userNotFound: {
            summary: 'The target user does not exist',
            value: errorContent('USER_NOT_FOUND')['application/json']?.example,
          },
          permissionNotFound: {
            summary: 'A validated permission is absent from the database catalog',
            value: errorContent('RESOURCE_NOT_FOUND')['application/json']?.example,
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'The same permission appears in both grants and revokes.',
    content: errorContent('RESOURCE_CONFLICT'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The grant or revoke arrays failed validation.',
    content: errorContent('VALIDATION_ERROR', path, {
      fields: { grants: ['each value in grants must be one of the following values'] },
    }),
  })
  public replacePermissions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ReplaceUserPermissionsDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<UserPermissionsResponseDto> {
    return this.service.replacePermissionOverrides(id, body, principal.userId, principal.roleKeys);
  }
}
