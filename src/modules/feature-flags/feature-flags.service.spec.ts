import { AppException } from '@/core/errors/app.exception';

import { FeatureFlagsService } from './feature-flags.service';

describe(FeatureFlagsService.name, () => {
  const flag = {
    id: 'flag-id',
    key: 'checkout.new-flow',
    description: 'New flow',
    enabled: false,
    version: 1,
    updatedByUserId: 'user-id',
    createdAt: new Date('2026-08-19T00:00:00Z'),
    updatedAt: new Date('2026-08-19T00:00:00Z'),
  };
  const repository = {
    findByKey: jest.fn(),
    findPage: jest.fn(),
    create: jest.fn(),
    appendAudit: jest.fn(),
    findByKeyForUpdate: jest.fn(),
    save: jest.fn(),
  };
  const context = {
    getRequestId: (): string => 'req-id',
    getCorrelationId: (): string => 'corr-id',
  };
  const manager = {};
  const dataSource = { transaction: jest.fn((work: (value: unknown) => unknown) => work(manager)) };
  const principal = {
    userId: 'user-id',
    sessionId: 'session-id',
    authVersion: 1,
    roleKeys: ['super_admin'] as const,
    permissions: ['feature-flags.manage'] as const,
  };
  const service = new FeatureFlagsService(
    repository as never,
    context as never,
    dataSource as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('evaluates a registered flag', async () => {
    repository.findByKey.mockResolvedValue({ ...flag, enabled: true });
    await expect(service.isEnabled(flag.key)).resolves.toBe(true);
  });

  it('rejects an unknown flag', async () => {
    repository.findByKey.mockResolvedValue(null);
    await expect(service.isEnabled('missing.flag')).rejects.toEqual(expect.any(AppException));
  });

  it('creates a flag and correlated audit in one transaction', async () => {
    repository.create.mockResolvedValue(flag);
    repository.appendAudit.mockResolvedValue(undefined);
    await expect(
      service.create(
        { key: flag.key, description: flag.description, enabled: false },
        principal as never,
      ),
    ).resolves.toMatchObject({ key: flag.key, version: 1 });
    expect(repository.appendAudit).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        requestId: 'req-id',
        correlationId: 'corr-id',
        previousEnabled: null,
      }),
    );
  });

  it('rejects a stale update', async () => {
    repository.findByKeyForUpdate.mockResolvedValue(flag);
    await expect(service.update(flag.key, true, 2, principal as never)).rejects.toEqual(
      expect.any(AppException),
    );
  });
});
