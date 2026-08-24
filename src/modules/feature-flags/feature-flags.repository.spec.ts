import { FeatureFlagsRepository } from './feature-flags.repository';

describe(FeatureFlagsRepository.name, () => {
  const typeOrmRepository = { findAndCount: jest.fn(), findOneBy: jest.fn() };
  const repository = new FeatureFlagsRepository(typeOrmRepository as never);
  const managedRepository = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const manager = { getRepository: jest.fn(() => managedRepository) };

  beforeEach(() => jest.clearAllMocks());

  it('uses deterministic pagination and key lookup', async () => {
    typeOrmRepository.findAndCount.mockResolvedValue([[], 0]);
    typeOrmRepository.findOneBy.mockResolvedValue(null);
    await repository.findPage(2, 20);
    await repository.findByKey('checkout.new-flow');
    expect(typeOrmRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({ key: 'checkout.new-flow' });
  });

  it('creates, locks, saves, and appends audits with the transaction manager', async () => {
    managedRepository.create.mockReturnValue({ key: 'checkout.new-flow' });
    managedRepository.save.mockResolvedValue({ key: 'checkout.new-flow' });
    managedRepository.findOne.mockResolvedValue(null);
    await repository.create(manager as never, {
      key: 'checkout.new-flow',
      description: 'New flow',
      enabled: false,
      updatedByUserId: 'user-id',
    });
    await repository.findByKeyForUpdate(manager as never, 'checkout.new-flow');
    await repository.save(manager as never, { key: 'checkout.new-flow' } as never);
    await repository.appendAudit(manager as never, {
      featureFlagId: 'flag-id',
      actorUserId: 'user-id',
      previousEnabled: null,
      enabled: false,
      requestId: 'req-id',
      correlationId: 'corr-id',
    });
    expect(managedRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(managedRepository.save).toHaveBeenCalledTimes(3);
  });
});
