import type { EntityManager } from 'typeorm';

import { UserAvatarAssociationEntity } from './entities/user-avatar-association.entity';
import { UserAvatarsRepository } from './user-avatars.repository';

describe(UserAvatarsRepository.name, () => {
  const entityRepository = {
    findOneBy: jest.fn(),
    create: jest.fn((value: { userId: string; fileId: string }) => value),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn(() => entityRepository),
  } as unknown as EntityManager;
  const repository = new UserAvatarsRepository();

  beforeEach(() => jest.clearAllMocks());

  it('looks up by user ID through the transaction manager', async () => {
    entityRepository.findOneBy.mockResolvedValue(null);
    await expect(repository.findByUserId(manager, 'user-1')).resolves.toBeNull();
    expect(manager.getRepository).toHaveBeenCalledWith(UserAvatarAssociationEntity);
  });

  it('creates and saves a new association', async () => {
    const entity = { id: 'association-1', userId: 'user-1', fileId: 'file-1' };
    entityRepository.save.mockResolvedValue(entity);
    await expect(repository.save(manager, 'user-1', 'file-1')).resolves.toBe(entity);
    expect(entityRepository.create).toHaveBeenCalledWith({ userId: 'user-1', fileId: 'file-1' });
  });

  it('deletes all associations for a user', async () => {
    await repository.remove(manager, 'user-1');
    expect(entityRepository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
