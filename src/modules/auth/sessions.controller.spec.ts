import { Test } from '@nestjs/testing';

import type { AuthenticatedPrincipal } from '@/modules/authorization';

import { AuthService } from './auth.service';
import { SessionsController } from './sessions.controller';

describe(SessionsController.name, () => {
  const service = {
    listSessions: jest.fn(),
    revokeOwnedSession: jest.fn(),
    revokeAllSessions: jest.fn(),
  };
  const principal: AuthenticatedPrincipal = {
    userId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    sessionId: 'b8f10c56-5e3c-42ee-8436-7994b9691ced',
    authVersion: 1,
    roleKeys: ['user'],
    permissions: [],
  };
  let controller: SessionsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();
    controller = module.get(SessionsController);
  });

  it('delegates paginated list and owned revocations', async () => {
    service.listSessions.mockResolvedValue({ items: [], meta: {} });
    await controller.list(principal, { page: 1, limit: 20 });
    await controller.revoke(principal, 'b8f10c56-5e3c-42ee-8436-7994b9691ced');
    await controller.revokeAll(principal);
    expect(service.listSessions).toHaveBeenCalledWith(principal.userId, 1, 20);
    expect(service.revokeAllSessions).toHaveBeenCalledWith(principal.userId);
  });
});
