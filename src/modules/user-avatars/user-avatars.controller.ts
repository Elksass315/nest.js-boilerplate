import { Body, Controller, Delete, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
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
import { swaggerErrorContent } from '@/common/swagger/api-error-response';
import type { ErrorCode } from '@/core/errors/error-definitions';
import {
  CurrentPrincipal,
  RequireAuthenticated,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';
import type { UserResponseDto } from '@/modules/users';

import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UserAvatarsService } from './user-avatars.service';

const route = '/api/v1/users/me/avatar';
const errorContent = (
  code: ErrorCode,
  details?: Record<string, unknown>,
): ReturnType<typeof swaggerErrorContent> => swaggerErrorContent(code, route, details);
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

@ApiTags('users')
@RequireAuthenticated()
@Controller({ path: 'users/me/avatar', version: API_VERSION })
export class UserAvatarsController {
  public constructor(private readonly service: UserAvatarsService) {}

  @Patch()
  @ApiOperation({
    summary: 'Set the current user avatar',
    description:
      'Validates and sanitizes a completed owned upload, atomically attaches it, and schedules replaced bytes for correlated cleanup.',
  })
  @ApiOkResponse({ description: 'The sanitized avatar was attached.', content: userContent })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The upload belongs to another user.',
    content: errorContent('FILE_OWNERSHIP_MISMATCH'),
  })
  @ApiNotFoundResponse({
    description: 'The user or upload no longer exists.',
    content: errorContent('FILE_NOT_FOUND'),
  })
  @ApiConflictResponse({
    description: 'The upload has not completed or cannot be claimed.',
    content: errorContent('FILE_NOT_READY'),
  })
  @ApiGoneResponse({
    description: 'The completed upload expired before it was claimed.',
    content: errorContent('FILE_UPLOAD_EXPIRED'),
  })
  @ApiPayloadTooLargeResponse({
    description: 'The source exceeds the configured avatar byte limit.',
    content: errorContent('FILE_TOO_LARGE'),
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'The image declaration, extension, or detected format is not allowed.',
    content: errorContent('FILE_TYPE_NOT_ALLOWED'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The file ID or decoded image failed validation.',
    content: errorContent('VALIDATION_ERROR', { fields: { fileId: ['fileId must be a UUID'] } }),
  })
  @ApiServiceUnavailableResponse({
    description: 'Storage could not read or persist the sanitized image.',
    content: errorContent('FILE_STORAGE_UNAVAILABLE'),
  })
  public replace(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: UpdateAvatarDto,
  ): Promise<UserResponseDto> {
    return this.service.replaceOwnAvatar(principal.userId, body.fileId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove the current user avatar',
    description: 'Detaches the avatar and schedules its bytes for idempotent correlated cleanup.',
  })
  @ApiNoContentResponse({
    description: 'The avatar was detached, or the user already had no avatar.',
    content: { 'application/json': { example: null } },
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiNotFoundResponse({
    description: 'The authenticated user no longer exists.',
    content: errorContent('USER_NOT_FOUND'),
  })
  public remove(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<void> {
    return this.service.deleteOwnAvatar(principal.userId);
  }
}
