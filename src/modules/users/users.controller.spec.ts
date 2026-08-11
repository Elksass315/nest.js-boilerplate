import { Test } from '@nestjs/testing';

import type { AuthenticatedPrincipal } from '@/modules/authorization';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe(UsersController.name, () => {
  const principal: AuthenticatedPrincipal = {
    userId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    authVersion: 1,
    roleKeys: ['super_admin'],
    permissions: ['users.read', 'users.status.manage', 'users.roles.manage'],
  };
  const service = {
    getSelf: jest.fn(),
    updateOwnProfile: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    updateStatus: jest.fn(),
    replaceRoles: jest.fn(),
  };
  let controller: UsersController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();
    controller = module.get(UsersController);
  });

  it('delegates self-service operations with the principal user ID', async () => {
    service.getSelf.mockResolvedValue({ id: principal.userId });
    service.updateOwnProfile.mockResolvedValue({ id: principal.userId });

    await controller.getMe(principal);
    await controller.updateMe(principal, { fullName: 'Amina Hassan' });

    expect(service.getSelf).toHaveBeenCalledWith(principal.userId);
    expect(service.updateOwnProfile).toHaveBeenCalledWith(principal.userId, 'Amina Hassan');
  });

  it('delegates paginated lookup and privileged mutations', async () => {
    service.list.mockResolvedValue({ items: [], meta: {} });
    service.getById.mockResolvedValue({ id: principal.userId });
    service.updateStatus.mockResolvedValue({ id: principal.userId });
    service.replaceRoles.mockResolvedValue({ id: principal.userId });

    await controller.list({ page: 2, limit: 10 });
    await controller.getById(principal.userId);
    await controller.updateStatus(principal.userId, { status: 'suspended' }, principal);
    await controller.replaceRoles(
      principal.userId,
      { roleIds: ['10000000-0000-4000-8000-000000000003'] },
      principal,
    );

    expect(service.list).toHaveBeenCalledWith(2, 10);
    expect(service.getById).toHaveBeenCalledWith(principal.userId);
    expect(service.updateStatus).toHaveBeenCalledWith(
      principal.userId,
      'suspended',
      principal.userId,
    );
    expect(service.replaceRoles).toHaveBeenCalledWith(
      principal.userId,
      ['10000000-0000-4000-8000-000000000003'],
      principal.userId,
    );
  });
});
