import type { Response } from 'express';
import { Readable } from 'node:stream';
import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { API_VERSION } from '@/common/http/api-version.constants';

import type { FilesService } from './files.service';
import { FilesController } from './files.controller';

describe(FilesController.name, () => {
  const service = { getPublicAccess: jest.fn() };
  const response = {
    redirect: jest.fn(),
    setHeader: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  } as unknown as Response;

  beforeEach(() => jest.clearAllMocks());

  it('registers under the global prefix and URI version exactly once', () => {
    expect(Reflect.getMetadata(PATH_METADATA, FilesController)).toBe('files');
    expect(Reflect.getMetadata(VERSION_METADATA, FilesController)).toBe(API_VERSION);
  });

  it('redirects object-storage responses', async () => {
    service.getPublicAccess.mockResolvedValue({ kind: 'redirect', url: 'https://example.test' });
    await new FilesController(service as unknown as FilesService).readPublic('public-id', response);
    expect(response.redirect).toHaveBeenCalledWith(302, 'https://example.test');
  });

  it('sets safe immutable headers for local streams', async () => {
    const stream = Readable.from('avatar');
    jest.spyOn(stream, 'pipe').mockReturnValue(response as never);
    service.getPublicAccess.mockResolvedValue({
      kind: 'stream',
      stream,
      mimeType: 'image/png',
      sizeBytes: '6',
      checksumSha256: 'checksum',
    });
    await new FilesController(service as unknown as FilesService).readPublic('public-id', response);
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.setHeader).toHaveBeenCalledWith('ETag', '"checksum"');
    expect(stream.pipe).toHaveBeenCalledWith(response);
  });
});
