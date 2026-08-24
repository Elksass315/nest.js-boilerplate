import { NotificationPreferencesRepository } from './notification-preferences.repository';

describe(NotificationPreferencesRepository.name, () => {
  const ormRepository = { findOneBy: jest.fn() };
  const managed = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const manager = { getRepository: jest.fn(() => managed) };
  const repository = new NotificationPreferencesRepository(ormRepository as never);

  it('owns user lookup and locked writes', async () => {
    ormRepository.findOneBy.mockResolvedValue(null);
    managed.findOne.mockResolvedValue(null);
    managed.create.mockReturnValue({ version: 1 });
    managed.save.mockResolvedValue({ version: 1 });
    await repository.findByUserId('user-id');
    await repository.findByUserIdForUpdate(manager as never, 'user-id');
    const created = repository.create(manager as never, {
      userId: 'user-id',
      productUpdatesEmail: false,
      marketingEmail: false,
    });
    await repository.save(manager as never, created);
    expect(managed.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(managed.save).toHaveBeenCalled();
  });
});
