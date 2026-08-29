import {
  Controller,
  Delete,
  Head,
  Options,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiPreconditionFailedResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { API_VERSION } from '@/common/http/api-version.constants';
import { swaggerErrorContent, type SwaggerErrorContent } from '@/common/swagger/api-error-response';
import type { AppConfiguration } from '@/config/configuration.types';
import type { ErrorCode } from '@/core/errors/error-definitions';
import {
  CurrentPrincipal,
  Public,
  RequireAuthenticated,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';
import { FilesService } from '@/modules/files';

const uploadPath = '/api/v1/users/me/avatar/uploads';
const errorContent = (code: ErrorCode): SwaggerErrorContent =>
  swaggerErrorContent(code, `${uploadPath}/4e951b98-9250-4414-b88c-33f184543d8c`);

@ApiTags('users')
@Controller({ path: 'users/me/avatar/uploads', version: API_VERSION })
export class UserAvatarUploadsController {
  private readonly maximumBytes: number;

  public constructor(
    private readonly files: FilesService,
    config: ConfigService<AppConfiguration, true>,
  ) {
    this.maximumBytes = config.getOrThrow('files', { infer: true }).userAvatar.maxBytes;
  }

  @Options()
  @Public()
  @ApiOperation({
    summary: 'Discover avatar upload capabilities',
    description:
      'Advertises supported tus version, extensions, and maximum upload size without changing state.',
  })
  @ApiNoContentResponse({
    description:
      'The supported resumable-upload capabilities were returned in tus response headers.',
    content: { 'application/json': { example: null } },
    headers: {
      'Tus-Resumable': { schema: { type: 'string', example: '1.0.0' } },
      'Tus-Version': { schema: { type: 'string', example: '1.0.0' } },
      'Tus-Extension': { schema: { type: 'string', example: 'creation,expiration,termination' } },
      'Tus-Max-Size': { schema: { type: 'integer', example: 5_242_880 } },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'The selected storage provider cannot advertise upload capabilities.',
    content: errorContent('FILE_STORAGE_UNAVAILABLE'),
  })
  public options(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.handle(request, response, null);
  }

  @Post()
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Create an avatar upload',
    description:
      'Creates a protected, expiring user_avatar tus upload owned by the authenticated user.',
  })
  @ApiHeader({
    name: 'Upload-Length',
    required: true,
    example: 148352,
    description: 'Exact source byte length; deferred length is unsupported.',
  })
  @ApiHeader({
    name: 'Upload-Metadata',
    required: true,
    example: 'filename YXZhdGFyLndlYnA=,filetype aW1hZ2Uvd2VicA==',
    description: 'Base64 tus filename and declared filetype metadata.',
  })
  @ApiHeader({
    name: 'Tus-Resumable',
    required: true,
    example: '1.0.0',
    description: 'tus protocol version.',
  })
  @ApiCreatedResponse({
    description:
      'The upload resource was created; Location identifies the server-generated upload URL.',
    content: { 'application/json': { example: null } },
    headers: {
      Location: {
        description: 'Relative resumable upload URL.',
        schema: { type: 'string', example: `${uploadPath}/4e951b98-9250-4414-b88c-33f184543d8c` },
      },
      'Tus-Resumable': { schema: { type: 'string', example: '1.0.0' } },
      'Upload-Expires': {
        schema: { type: 'string', example: 'Sat, 15 Aug 2026 12:00:00 GMT' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Upload length or metadata is missing or malformed.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiPreconditionFailedResponse({
    description: 'The tus protocol version is unsupported.',
    content: errorContent('TUS_VERSION_UNSUPPORTED'),
  })
  @ApiPayloadTooLargeResponse({
    description: 'The source exceeds the configured avatar limit.',
    content: errorContent('FILE_TOO_LARGE'),
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'The declared media type is not JPEG, PNG, or WebP.',
    content: errorContent('FILE_TYPE_NOT_ALLOWED'),
  })
  @ApiServiceUnavailableResponse({
    description: 'The selected storage provider is unavailable.',
    content: errorContent('FILE_STORAGE_UNAVAILABLE'),
  })
  public create(
    @Req() request: Request,
    @Res() response: Response,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    return this.handle(request, response, principal);
  }

  @Head(':uploadId')
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Inspect an avatar upload offset',
    description:
      'Returns the current offset only when the upload belongs to the authenticated user and remains active.',
  })
  @ApiHeader({
    name: 'Tus-Resumable',
    required: true,
    example: '1.0.0',
    description: 'tus protocol version.',
  })
  @ApiOkResponse({
    description: 'The current Upload-Offset and Upload-Length headers were returned.',
    content: { 'application/json': { example: null } },
    headers: {
      'Tus-Resumable': { schema: { type: 'string', example: '1.0.0' } },
      'Upload-Offset': { schema: { type: 'integer', example: 65_536 } },
      'Upload-Length': { schema: { type: 'integer', example: 148_352 } },
      'Upload-Expires': {
        schema: { type: 'string', example: 'Sat, 15 Aug 2026 12:00:00 GMT' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'The upload identifier is malformed.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The upload belongs to another user.',
    content: errorContent('FILE_OWNERSHIP_MISMATCH'),
  })
  @ApiNotFoundResponse({
    description: 'The upload does not exist for this purpose.',
    content: errorContent('FILE_NOT_FOUND'),
  })
  @ApiGoneResponse({
    description: 'The upload expired.',
    content: errorContent('FILE_UPLOAD_EXPIRED'),
  })
  @ApiPreconditionFailedResponse({
    description: 'The tus protocol version is unsupported.',
    content: errorContent('TUS_VERSION_UNSUPPORTED'),
  })
  @ApiServiceUnavailableResponse({
    description: 'Storage failed while inspecting the upload offset.',
    content: errorContent('FILE_STORAGE_UNAVAILABLE'),
  })
  public inspect(
    @Param('uploadId', new ParseUUIDPipe({ version: '4' })) _uploadId: string,
    @Req() request: Request,
    @Res() response: Response,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    return this.handle(request, response, principal);
  }

  @Patch(':uploadId')
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Append avatar upload bytes',
    description:
      'Appends binary bytes at the exact stored offset and completes the upload when its declared length is reached.',
  })
  @ApiHeader({
    name: 'Tus-Resumable',
    required: true,
    example: '1.0.0',
    description: 'tus protocol version.',
  })
  @ApiHeader({
    name: 'Upload-Offset',
    required: true,
    example: 65536,
    description: 'Client-known byte offset before this chunk.',
  })
  @ApiConsumes('application/offset+octet-stream')
  @ApiBody({
    required: true,
    schema: { type: 'string', format: 'binary', example: '<binary avatar chunk>' },
  })
  @ApiNoContentResponse({
    description: 'The bytes were appended and Upload-Offset contains the next offset.',
    content: { 'application/json': { example: null } },
    headers: {
      'Tus-Resumable': { schema: { type: 'string', example: '1.0.0' } },
      'Upload-Offset': { schema: { type: 'integer', example: 148_352 } },
      'Upload-Expires': {
        schema: { type: 'string', example: 'Sat, 15 Aug 2026 12:00:00 GMT' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'The upload identifier or binary request is malformed.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The upload belongs to another user.',
    content: errorContent('FILE_OWNERSHIP_MISMATCH'),
  })
  @ApiNotFoundResponse({
    description: 'The upload does not exist for this purpose.',
    content: errorContent('FILE_NOT_FOUND'),
  })
  @ApiConflictResponse({
    description: 'Upload-Offset differs from the stored offset.',
    content: errorContent('FILE_OFFSET_MISMATCH'),
  })
  @ApiGoneResponse({
    description: 'The upload expired.',
    content: errorContent('FILE_UPLOAD_EXPIRED'),
  })
  @ApiPreconditionFailedResponse({
    description: 'The tus protocol version is unsupported.',
    content: errorContent('TUS_VERSION_UNSUPPORTED'),
  })
  @ApiServiceUnavailableResponse({
    description: 'Storage failed while appending or completing the upload.',
    content: errorContent('FILE_STORAGE_UNAVAILABLE'),
  })
  public append(
    @Param('uploadId', new ParseUUIDPipe({ version: '4' })) _uploadId: string,
    @Req() request: Request,
    @Res() response: Response,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    return this.handle(request, response, principal);
  }

  @Delete(':uploadId')
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Terminate an avatar upload',
    description:
      'Terminates an owned incomplete upload and removes its temporary bytes and metadata.',
  })
  @ApiHeader({
    name: 'Tus-Resumable',
    required: true,
    example: '1.0.0',
    description: 'tus protocol version.',
  })
  @ApiNoContentResponse({
    description: 'The incomplete upload was terminated.',
    content: { 'application/json': { example: null } },
    headers: {
      'Tus-Resumable': { schema: { type: 'string', example: '1.0.0' } },
    },
  })
  @ApiBadRequestResponse({
    description: 'The upload identifier is malformed.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The upload belongs to another user.',
    content: errorContent('FILE_OWNERSHIP_MISMATCH'),
  })
  @ApiNotFoundResponse({
    description: 'The upload does not exist for this purpose.',
    content: errorContent('FILE_NOT_FOUND'),
  })
  @ApiGoneResponse({
    description: 'The upload expired.',
    content: errorContent('FILE_UPLOAD_EXPIRED'),
  })
  @ApiPreconditionFailedResponse({
    description: 'The tus protocol version is unsupported.',
    content: errorContent('TUS_VERSION_UNSUPPORTED'),
  })
  @ApiServiceUnavailableResponse({
    description: 'Storage failed while terminating the upload.',
    content: errorContent('FILE_STORAGE_UNAVAILABLE'),
  })
  public terminate(
    @Param('uploadId', new ParseUUIDPipe({ version: '4' })) _uploadId: string,
    @Req() request: Request,
    @Res() response: Response,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    return this.handle(request, response, principal);
  }

  private handle(
    request: Request,
    response: Response,
    principal: AuthenticatedPrincipal | null,
  ): Promise<void> {
    return this.files.handleTus(request, response, {
      uploaderId: principal?.userId ?? null,
      requestId: request.requestId ?? 'unavailable',
      correlationId: request.correlationId ?? request.requestId ?? 'unavailable',
      routePath: uploadPath,
      policy: {
        purpose: 'user_avatar',
        maxBytes: this.maximumBytes,
        allowedDeclaredMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      },
    });
  }
}
