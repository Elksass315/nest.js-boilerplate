import { Test } from '@nestjs/testing';

import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';

describe(AuthorizationController.name, () => {
  it('delegates the canonical page parameters', async () => {
    const service = { listRoles: jest.fn().mockResolvedValue({ items: [], meta: {} }) };
    const module = await Test.createTestingModule({
      controllers: [AuthorizationController],
      providers: [{ provide: AuthorizationService, useValue: service }],
    }).compile();
    const controller = module.get(AuthorizationController);

    await controller.list({ page: 2, limit: 10 });

    expect(service.listRoles).toHaveBeenCalledWith(2, 10);
  });
});
