import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import type { AppConfiguration } from '@/config/configuration.types';
import type { AuthenticatedPrincipal } from '@/modules/authorization';
import type { FilesService } from '@/modules/files';

import { UserAvatarUploadsController } from './user-avatar-uploads.controller';

describe(UserAvatarUploadsController.name, () => {
  const files = { handleTus: jest.fn() };
  const config = {
    getOrThrow: jest.fn(() => ({ userAvatar: { maxBytes: 5_242_880 } })),
  } as unknown as ConfigService<AppConfiguration, true>;
  const controller = new UserAvatarUploadsController(files as unknown as FilesService, config);
  const request = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
  } as Request;
  const response = {} as Response;
  const principal: AuthenticatedPrincipal = {
    userId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    authVersion: 1,
    roleKeys: ['user'],
    permissions: [],
  };

  beforeEach(() => jest.clearAllMocks());

  it('keeps OPTIONS anonymous and delegates stateful methods with a fixed policy', async () => {
    await controller.options(request, response);
    await controller.create(request, response, principal);
    await controller.inspect('4e951b98-9250-4414-b88c-33f184543d8c', request, response, principal);
    await controller.append('4e951b98-9250-4414-b88c-33f184543d8c', request, response, principal);
    await controller.terminate(
      '4e951b98-9250-4414-b88c-33f184543d8c',
      request,
      response,
      principal,
    );

    expect(files.handleTus).toHaveBeenNthCalledWith(
      1,
      request,
      response,
      expect.objectContaining({
        uploaderId: null,
        policy: expect.objectContaining({ purpose: 'user_avatar' }),
      }),
    );
    expect(files.handleTus).toHaveBeenLastCalledWith(
      request,
      response,
      expect.objectContaining({
        uploaderId: principal.userId,
        requestId: 'request-1',
        correlationId: 'correlation-1',
        policy: expect.objectContaining({ maxBytes: 5_242_880 }),
      }),
    );
  });
});
