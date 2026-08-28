import type { EntityManager } from 'typeorm';

import { UserAvatarsService } from './user-avatars.service';

describe(UserAvatarsService.name, () => {
  const repository = {
    findByUserId: jest.fn(),
    remove: jest.fn(),
    save: jest.fn(),
  };
  const manager = {} as EntityManager;
  const service = new UserAvatarsService(repository);

  beforeEach(() => jest.clearAllMocks());

  it('returns the associated file ID or null', async () => {
    repository.findByUserId.mockResolvedValue({ fileId: 'file-1' });
    await expect(service.findFileId(manager, 'user-1')).resolves.toBe('file-1');
    repository.findByUserId.mockResolvedValue(null);
    await expect(service.findFileId(manager, 'user-1')).resolves.toBeNull();
  });

  it('replaces an association within the caller transaction', async () => {
    await service.attach(manager, 'user-1', 'file-2');
    expect(repository.remove).toHaveBeenCalledWith(manager, 'user-1');
    expect(repository.save).toHaveBeenCalledWith(manager, 'user-1', 'file-2');
  });

  it('removes an association idempotently', async () => {
    await service.remove(manager, 'user-1');
    expect(repository.remove).toHaveBeenCalledWith(manager, 'user-1');
  });
});
