import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { API_VERSION } from '@/common/http/api-version.constants';
import {
  CurrentPrincipal,
  PermissionsGuard,
  RequireAuthenticated,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';

import { NotificationPreferencesResponseDto } from './dto/notification-preferences-response.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreferencesService } from './notification-preferences.service';

const path = '/api/v1/users/me/notification-preferences';
const responseExample = {
  securityEmail: true,
  productUpdatesEmail: false,
  marketingEmail: false,
  version: 0,
  updatedAt: null,
};
const content = { 'application/json': { example: responseExample } };
const errorContent = (
  statusCode: number,
  code: string,
  message: string,
): Record<string, { example: Record<string, unknown> }> => ({
  'application/json': {
    example: {
      statusCode,
      code,
      message,
      timestamp: '2026-08-24T12:00:00.000Z',
      path,
      requestId: 'req_notification_preferences_example',
      correlationId: 'corr_notification_preferences_example',
    },
  },
});

@ApiTags('notification preferences')
@UseGuards(PermissionsGuard)
@Controller({ path: 'users/me/notification-preferences', version: API_VERSION })
export class NotificationPreferencesController {
  public constructor(private readonly service: NotificationPreferencesService) {}

  @Get()
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Get personal notification preferences',
    description:
      'Returns safe opt-in defaults when no preference row exists; mandatory security email cannot be disabled.',
  })
  @ApiOkResponse({ description: 'The effective notification preferences were returned.', content })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiNotFoundResponse({
    description: 'The authenticated user no longer exists.',
    content: errorContent(404, 'USER_NOT_FOUND', 'The requested user was not found'),
  })
  public get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationPreferencesResponseDto> {
    return this.service.getForUser(principal.userId);
  }

  @Patch()
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Replace personal optional email preferences',
    description:
      'Atomically replaces optional email choices using the version from the latest read; security email remains mandatory.',
  })
  @ApiOkResponse({
    description: 'The preferences were stored or already matched the requested values.',
    content: {
      'application/json': {
        example: {
          ...responseExample,
          productUpdatesEmail: true,
          version: 1,
          updatedAt: '2026-08-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiNotFoundResponse({
    description: 'The authenticated user no longer exists.',
    content: errorContent(404, 'USER_NOT_FOUND', 'The requested user was not found'),
  })
  @ApiConflictResponse({
    description: 'The supplied version is stale or initial creation raced another request.',
    content: errorContent(
      409,
      'NOTIFICATION_PREFERENCES_VERSION_CONFLICT',
      'Notification preferences changed; read them again before retrying',
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'A preference value or expectedVersion failed validation.',
    content: errorContent(422, 'VALIDATION_ERROR', 'Input validation failed'),
  })
  public update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponseDto> {
    return this.service.update(principal.userId, body);
  }
}
