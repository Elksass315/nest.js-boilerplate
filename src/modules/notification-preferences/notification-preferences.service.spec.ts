import { NotificationPreferencesService } from './notification-preferences.service';

describe(NotificationPreferencesService.name, () => {
  const repository = {
    findByUserId: jest.fn(),
    findByUserIdForUpdate: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const users = { getSelf: jest.fn() };
  const manager = {};
  const dataSource = {
    transaction: jest.fn((work: (value: unknown) => unknown) => work(manager)),
  };
  const service = new NotificationPreferencesService(
    repository as never,
    users as never,
    dataSource as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns privacy-safe defaults without creating a row', async () => {
    users.getSelf.mockResolvedValue({ id: 'user-id' });
    repository.findByUserId.mockResolvedValue(null);
    await expect(service.getForUser('user-id')).resolves.toEqual({
      securityEmail: true,
      productUpdatesEmail: false,
      marketingEmail: false,
      version: 0,
      updatedAt: null,
    });
  });

  it('creates initial preferences from version zero', async () => {
    const stored = {
      productUpdatesEmail: true,
      marketingEmail: false,
      version: 1,
      updatedAt: new Date('2026-08-24T00:00:00.000Z'),
    };
    users.getSelf.mockResolvedValue({ id: 'user-id' });
    repository.findByUserIdForUpdate.mockResolvedValue(null);
    repository.create.mockReturnValue(stored);
    repository.save.mockResolvedValue(stored);
    await expect(
      service.update('user-id', {
        productUpdatesEmail: true,
        marketingEmail: false,
        expectedVersion: 0,
      }),
    ).resolves.toMatchObject({ securityEmail: true, version: 1 });
  });

  it('rejects a stale version', async () => {
    users.getSelf.mockResolvedValue({ id: 'user-id' });
    repository.findByUserIdForUpdate.mockResolvedValue({ version: 2 });
    const result = service.update('user-id', {
      productUpdatesEmail: false,
      marketingEmail: false,
      expectedVersion: 1,
    });
    await expect(result).rejects.toMatchObject({
      response: { code: 'NOTIFICATION_PREFERENCES_VERSION_CONFLICT' },
    });
  });

  it('evaluates optional email categories as opt-in', async () => {
    repository.findByUserId.mockResolvedValue({
      productUpdatesEmail: true,
      marketingEmail: false,
    });
    await expect(service.isOptionalEmailEnabled('user-id', 'product_updates')).resolves.toBe(true);
    await expect(service.isOptionalEmailEnabled('user-id', 'marketing')).resolves.toBe(false);
  });
});
