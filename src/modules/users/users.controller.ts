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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import {
  CurrentPrincipal,
  PermissionsGuard,
  RequireAuthenticated,
  RequirePermissions,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';

import { ReplaceUserRolesDto } from './dto/replace-user-roles.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
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
      avatar: {
        fileId: '4e951b98-9250-4414-b88c-33f184543d8c',
        url: '/api/v1/files/public/67aa21ed-3e95-40cd-a2a1-67370da05d32',
        mimeType: 'image/webp',
        size: 148352,
      },
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
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required', `${path}/me/avatar`),
  })
  @ApiForbiddenResponse({
    description: 'The upload belongs to another user.',
    content: errorContent(
      403,
      'FILE_OWNERSHIP_MISMATCH',
      'The file does not belong to the authenticated user',
      `${path}/me/avatar`,
    ),
  })
  @ApiNotFoundResponse({
    description: 'The user or upload no longer exists.',
    content: {
      'application/json': {
        examples: {
          fileNotFound: {
            summary: 'The upload does not exist',
            value: errorContent(
              404,
              'FILE_NOT_FOUND',
              'The requested file was not found',
              `${path}/me/avatar`,
            )['application/json']?.example,
          },
          userNotFound: {
            summary: 'The authenticated user no longer exists',
            value: errorContent(
              404,
              'USER_NOT_FOUND',
              'The requested user was not found',
              `${path}/me/avatar`,
            )['application/json']?.example,
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'The upload has not completed or cannot be claimed.',
    content: errorContent(
      409,
      'FILE_NOT_READY',
      'The file is not ready to use',
      `${path}/me/avatar`,
    ),
  })
  @ApiGoneResponse({
    description: 'The completed upload expired before it was claimed.',
    content: errorContent(
      410,
      'FILE_UPLOAD_EXPIRED',
      'The file upload has expired',
      `${path}/me/avatar`,
    ),
  })
  @ApiPayloadTooLargeResponse({
    description: 'The source exceeds the configured avatar byte limit.',
    content: errorContent(
      413,
      'FILE_TOO_LARGE',
      'The file exceeds the allowed size',
      `${path}/me/avatar`,
    ),
  })
  @ApiUnsupportedMediaTypeResponse({
    description:
      'The declaration, extension, or detected format is not an allowed matching JPEG, PNG, or WebP image.',
    content: errorContent(
      415,
      'FILE_TYPE_NOT_ALLOWED',
      'The file type is not allowed',
      `${path}/me/avatar`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description:
      'The file ID is invalid or the image is animated, malformed, oversized in dimensions, or unsafe to decode.',
    content: {
      'application/json': {
        examples: {
          invalidFileId: {
            summary: 'The file identifier is not a UUID',
            value: errorContent(
              422,
              'VALIDATION_ERROR',
              'Input validation failed',
              `${path}/me/avatar`,
              {
                fields: { fileId: ['fileId must be a UUID'] },
              },
            )['application/json']?.example,
          },
          invalidImage: {
            summary: 'The image cannot be safely processed',
            value: errorContent(
              422,
              'FILE_INVALID_IMAGE',
              'The uploaded image is invalid',
              `${path}/me/avatar`,
            )['application/json']?.example,
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Storage could not read the upload or persist the sanitized result.',
    content: errorContent(
      503,
      'FILE_STORAGE_UNAVAILABLE',
      'File storage is temporarily unavailable',
      `${path}/me/avatar`,
    ),
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
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required', `${path}/me/avatar`),
  })
  @ApiNotFoundResponse({
    description: 'The authenticated user no longer exists.',
    content: errorContent(
      404,
      'USER_NOT_FOUND',
      'The requested user was not found',
      `${path}/me/avatar`,
    ),
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
