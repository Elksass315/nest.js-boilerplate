import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
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
  RequirePermissions,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';

import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { FeatureFlagResponseDto } from './dto/feature-flag-response.dto';
import { FeatureFlagKeyParamsDto } from './dto/feature-flag-key-params.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FeatureFlagsService } from './feature-flags.service';

const path = '/api/v1/feature-flags';
const flagExample = {
  id: '00adcbf5-0ee7-493d-a46a-0b1b108e14fc',
  key: 'checkout.new-flow',
  description: 'Enables the replacement checkout flow.',
  enabled: false,
  version: 1,
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
};
const error = (
  statusCode: number,
  code: string,
  message: string,
): Record<string, { example: Record<string, unknown> }> => ({
  'application/json': {
    example: {
      statusCode,
      code,
      message,
      timestamp: '2026-08-19T12:00:00.000Z',
      path,
      requestId: 'req_feature_flag_example',
      correlationId: 'corr_feature_flag_example',
    },
  },
});

@ApiTags('feature flags')
@UseGuards(PermissionsGuard)
@Controller({ path: 'feature-flags', version: API_VERSION })
export class FeatureFlagsController {
  public constructor(private readonly service: FeatureFlagsService) {}

  @Get()
  @RequirePermissions('feature-flags.read')
  @ApiOperation({
    summary: 'List feature flags',
    description: 'Returns a bounded offset page ordered by stable flag key.',
  })
  @ApiOffsetPaginatedResponse(
    FeatureFlagResponseDto,
    'The requested feature-flag page was returned.',
  )
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
    content: error(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'Feature-flag read permission is required.',
    content: error(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: error(422, 'VALIDATION_ERROR', 'Input validation failed'),
  })
  public list(
    @Query() query: OffsetPaginationQueryDto,
  ): Promise<OffsetPage<FeatureFlagResponseDto>> {
    return this.service.list(query.page, query.limit);
  }

  @Get(':key')
  @RequirePermissions('feature-flags.read')
  @ApiOperation({
    summary: 'Get a feature flag',
    description: 'Returns one global feature-flag definition and its current version.',
  })
  @ApiOkResponse({
    description: 'The feature flag was returned.',
    content: { 'application/json': { example: flagExample } },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
    content: error(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'Feature-flag read permission is required.',
    content: error(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiNotFoundResponse({
    description: 'The key is not registered.',
    content: error(404, 'FEATURE_FLAG_NOT_FOUND', 'The requested feature flag was not found'),
  })
  public get(@Param() params: FeatureFlagKeyParamsDto): Promise<FeatureFlagResponseDto> {
    return this.service.get(params.key);
  }

  @Post()
  @RequirePermissions('feature-flags.manage')
  @ApiOperation({
    summary: 'Create a feature flag',
    description:
      'Registers a unique global boolean flag and records a correlated append-only audit.',
  })
  @ApiCreatedResponse({
    description: 'The feature flag was created.',
    content: { 'application/json': { example: flagExample } },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
    content: error(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'Feature-flag management permission is required.',
    content: error(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiConflictResponse({
    description: 'The key is already registered.',
    content: error(
      409,
      'FEATURE_FLAG_ALREADY_EXISTS',
      'A feature flag with this key already exists',
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The key, description, or enabled value failed validation.',
    content: error(422, 'VALIDATION_ERROR', 'Input validation failed'),
  })
  public create(
    @Body() body: CreateFeatureFlagDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FeatureFlagResponseDto> {
    return this.service.create(body, principal);
  }

  @Patch(':key')
  @RequirePermissions('feature-flags.manage')
  @ApiOperation({
    summary: 'Change a feature flag',
    description:
      'Atomically changes a flag using optimistic version validation and records correlated audit context.',
  })
  @ApiOkResponse({
    description: 'The feature flag was updated.',
    content: { 'application/json': { example: { ...flagExample, enabled: true, version: 2 } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
    content: error(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'Feature-flag management permission is required.',
    content: error(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiNotFoundResponse({
    description: 'The key is not registered.',
    content: error(404, 'FEATURE_FLAG_NOT_FOUND', 'The requested feature flag was not found'),
  })
  @ApiConflictResponse({
    description: 'The supplied version is stale.',
    content: error(
      409,
      'FEATURE_FLAG_VERSION_CONFLICT',
      'The feature flag changed; read it again before retrying',
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Enabled or expectedVersion failed validation.',
    content: error(422, 'VALIDATION_ERROR', 'Input validation failed'),
  })
  public update(
    @Param() params: FeatureFlagKeyParamsDto,
    @Body() body: UpdateFeatureFlagDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FeatureFlagResponseDto> {
    return this.service.update(params.key, body.enabled, body.expectedVersion, principal);
  }
}
