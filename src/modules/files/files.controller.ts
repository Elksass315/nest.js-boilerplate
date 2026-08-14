import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { API_VERSION } from '@/common/http/api-version.constants';

import { FilesService } from './files.service';

const routePath = '/api/v1/files/public/:publicId';
type SwaggerErrorContent = Record<
  string,
  {
    example: {
      statusCode: number;
      code: string;
      message: string;
      timestamp: string;
      path: string;
      requestId: string;
    };
  }
>;

const errorContent = (statusCode: number, code: string, message: string): SwaggerErrorContent => ({
  'application/json': {
    example: {
      statusCode,
      code,
      message,
      timestamp: '2026-08-14T12:00:00.000Z',
      path: routePath,
      requestId: 'req_example',
    },
  },
});

@ApiTags('files')
@Controller({ path: 'files', version: API_VERSION })
export class FilesController {
  public constructor(private readonly service: FilesService) {}

  @Get('public/:publicId')
  @ApiOperation({
    summary: 'Read a public file',
    description:
      'Streams a ready public local file or redirects to a temporary S3 URL. Protected and unavailable files are indistinguishable from missing files.',
  })
  @ApiOkResponse({
    description: 'The public file bytes were returned.',
    content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiFoundResponse({
    description: 'The public file is available from a temporary object-storage URL.',
    content: {
      'text/html': {
        example: '<p>Found. Redirecting to the temporary object-storage download URL.</p>',
      },
    },
    headers: {
      Location: { description: 'Temporary object-storage URL.', schema: { type: 'string' } },
    },
  })
  @ApiNotFoundResponse({
    description: 'The file does not exist or is not public and ready.',
    content: errorContent(404, 'FILE_NOT_FOUND', 'The requested file was not found'),
  })
  @ApiBadRequestResponse({
    description: 'The public file identifier is not a UUID.',
    content: errorContent(400, 'BAD_REQUEST', 'The request could not be processed'),
  })
  @ApiServiceUnavailableResponse({
    description: 'The configured provider could not serve the file.',
    content: errorContent(
      503,
      'FILE_STORAGE_UNAVAILABLE',
      'File storage is temporarily unavailable',
    ),
  })
  public async readPublic(
    @Param('publicId', new ParseUUIDPipe()) publicId: string,
    @Res() response: Response,
  ): Promise<void> {
    const access = await this.service.getPublicAccess(publicId);
    if (access.kind === 'redirect') {
      response.redirect(302, access.url);
      return;
    }
    response.setHeader('Content-Type', access.mimeType);
    response.setHeader('Content-Length', access.sizeBytes);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (access.checksumSha256) response.setHeader('ETag', `"${access.checksumSha256}"`);
    access.stream.pipe(response);
  }
}
