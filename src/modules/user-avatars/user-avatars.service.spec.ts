import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';

import { RequestContextService } from '@/core/request-context/request-context.service';
import { FilesService } from '@/modules/files';
import { UsersService } from '@/modules/users';

import { AvatarImageService } from './avatar-image.service';
import { UserAvatarsRepository } from './user-avatars.repository';
import { UserAvatarsService } from './user-avatars.service';

describe(UserAvatarsService.name, () => {
  const repository = {
    findByUserId: jest.fn(),
    remove: jest.fn(),
    save: jest.fn(),
  };
  const manager = {} as EntityManager;
  let service: UserAvatarsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UserAvatarsService,
        { provide: UserAvatarsRepository, useValue: repository },
        { provide: FilesService, useValue: {} },
        { provide: AvatarImageService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: RequestContextService, useValue: {} },
        { provide: getDataSourceToken(), useValue: { manager } },
      ],
    }).compile();
    service = module.get(UserAvatarsService);
  });

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
