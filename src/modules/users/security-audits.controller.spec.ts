import { Test } from '@nestjs/testing';

import type { AuthenticatedPrincipal } from '@/modules/authorization';

import { SecurityAuditsController } from './security-audits.controller';
import { UsersService } from './users.service';

describe(SecurityAuditsController.name, () => {
  const principal: AuthenticatedPrincipal = {
    userId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    authVersion: 1,
    roleKeys: ['super_admin'],
    permissions: ['users.security-audits.read.any'],
  };
  const service = {
    listOwnSecurityAudits: jest.fn(),
    listUserSecurityAudits: jest.fn(),
  };
  let controller: SecurityAuditsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [SecurityAuditsController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();
    controller = module.get(SecurityAuditsController);
  });

  it('scopes personal history to the authenticated principal', async () => {
    service.listOwnSecurityAudits.mockResolvedValue({ items: [], meta: {} });

    await controller.listOwn(principal, { page: 2, limit: 10 });

    expect(service.listOwnSecurityAudits).toHaveBeenCalledWith(principal.userId, 2, 10);
  });

  it('delegates a privileged target-user lookup', async () => {
    service.listUserSecurityAudits.mockResolvedValue({ items: [], meta: {} });

    await controller.listForUser(principal.userId, { page: 3, limit: 5 });

    expect(service.listUserSecurityAudits).toHaveBeenCalledWith(principal.userId, 3, 5);
  });
});
