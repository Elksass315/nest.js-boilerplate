import { FeatureFlagsController } from './feature-flags.controller';

describe(FeatureFlagsController.name, () => {
  const service = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const controller = new FeatureFlagsController(service as never);
  const principal = { userId: 'user-id' };

  beforeEach(() => jest.clearAllMocks());

  it('delegates every HTTP workflow to the service', async () => {
    service.list.mockResolvedValue({ items: [], meta: {} });
    service.get.mockResolvedValue({ key: 'checkout.new-flow' });
    service.create.mockResolvedValue({ key: 'checkout.new-flow' });
    service.update.mockResolvedValue({ key: 'checkout.new-flow', enabled: true });

    await controller.list({ page: 1, limit: 20 });
    await controller.get({ key: 'checkout.new-flow' });
    await controller.create(
      { key: 'checkout.new-flow', description: 'New flow', enabled: false },
      principal as never,
    );
    await controller.update(
      { key: 'checkout.new-flow' },
      { enabled: true, expectedVersion: 1 },
      principal as never,
    );

    expect(service.list).toHaveBeenCalledWith(1, 20);
    expect(service.get).toHaveBeenCalledWith('checkout.new-flow');
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
      principal,
    );
    expect(service.update).toHaveBeenCalledWith('checkout.new-flow', true, 1, principal);
  });
});
