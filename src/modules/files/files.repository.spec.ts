import type { DataSource, Repository } from 'typeorm';

import { FileEntity } from './entities/file.entity';
import { FilesRepository } from './files.repository';

describe(FilesRepository.name, () => {
  const entity = Object.assign(new FileEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    publicId: '22222222-2222-4222-8222-222222222222',
    provider: 'local' as const,
    storageKey: 'storage-key',
    originalName: 'avatar.png',
    mimeType: 'image/png',
    sizeBytes: '6',
    checksumSha256: 'checksum',
    visibility: 'protected' as const,
    status: 'uploaded' as const,
    purpose: 'user_avatar',
    uploadedBy: '33333333-3333-4333-8333-333333333333',
    expiresAt: new Date('2026-08-15T00:00:00Z'),
    completedAt: new Date('2026-08-14T00:00:00Z'),
    claimedAt: null,
    deleteRequestedAt: null,
    failureCode: null,
    pendingDeleteProvider: null,
    pendingDeleteStorageKey: null,
    requestId: 'request-1',
    correlationId: 'correlation-1',
  });
  const query = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    take: jest.fn(),
    getMany: jest.fn(),
  };
  const files = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    countBy: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
  };
  const runner = { connect: jest.fn(), query: jest.fn(), release: jest.fn() };
  const dataSource = { createQueryRunner: jest.fn(() => runner) };
  const managerFiles = {
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const manager = { getRepository: jest.fn(() => managerFiles) };
  let repository: FilesRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    query.where.mockReturnValue(query);
    query.andWhere.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    query.addOrderBy.mockReturnValue(query);
    query.take.mockReturnValue(query);
    query.getMany.mockResolvedValue([entity]);
    files.createQueryBuilder.mockReturnValue(query);
    files.create.mockReturnValue(entity);
    files.save.mockResolvedValue(entity);
    files.update.mockResolvedValue({ affected: 1 });
    managerFiles.findOne.mockResolvedValue(entity);
    managerFiles.findOneByOrFail.mockResolvedValue(entity);
    managerFiles.save.mockImplementation((value: FileEntity) => Promise.resolve(value));
    repository = new FilesRepository(
      files as unknown as Repository<FileEntity>,
      dataSource as unknown as DataSource,
    );
  });

  it('creates protected upload metadata and maps it to the public contract', async () => {
    await expect(
      repository.createUpload(entity.id, 'local', 'avatar.png', 'image/png', 6, entity.expiresAt, {
        uploaderId: entity.uploadedBy,
        requestId: entity.requestId,
        correlationId: entity.correlationId,
        routePath: '/uploads',
        policy: {
          purpose: 'user_avatar',
          maxBytes: 100,
          allowedDeclaredMimeTypes: ['image/png'],
        },
      }),
    ).resolves.toEqual(expect.objectContaining({ provider: 'local', status: 'uploaded' }));
    expect(files.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'protected' }));
  });

  it('cleans bounded expired temporary metadata and tolerates empty driver results', async () => {
    files.query.mockResolvedValue({ rowCount: 2 });
    await expect(repository.cleanupTemporaryMetadata(new Date('2026-01-01'), 5)).resolves.toBe(2);
    files.query.mockResolvedValue(undefined);
    await expect(repository.cleanupTemporaryMetadata(new Date('2026-01-01'), 5)).resolves.toBe(0);
  });

  it('finds file, public file, and missing file metadata', async () => {
    files.findOneBy
      .mockResolvedValueOnce(entity)
      .mockResolvedValueOnce(entity)
      .mockResolvedValue(null);
    await expect(repository.findById(entity.id)).resolves.toEqual(
      expect.objectContaining({ id: entity.id }),
    );
    await expect(repository.findPublic(entity.publicId)).resolves.toEqual(
      expect.objectContaining({ publicId: entity.publicId }),
    );
    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('locks, claims, and lists public-ready file descriptors', async () => {
    files.find.mockResolvedValue([
      Object.assign(new FileEntity(), entity, { status: 'ready', visibility: 'public' }),
    ]);
    await expect(repository.findByIdForUpdate(manager as never, entity.id)).resolves.toEqual(
      expect.objectContaining({ id: entity.id }),
    );
    await expect(repository.findReadyPublicByIds([entity.id])).resolves.toEqual([
      expect.objectContaining({ fileId: entity.id, url: expect.stringContaining(entity.publicId) }),
    ]);
    await expect(
      repository.claimPrepared(manager as never, entity, {
        fileId: entity.id,
        provider: 'local',
        storageKey: 'ready/new',
        mimeType: 'image/png',
        sizeBytes: 20,
        checksumSha256: 'new-checksum',
      }),
    ).resolves.toEqual(expect.objectContaining({ sizeBytes: 20 }));
    await repository.markDeletingInTransaction(manager as never, entity.id);
    expect(managerFiles.update).toHaveBeenCalledWith(
      { id: entity.id, status: 'ready' },
      expect.objectContaining({ status: 'deleting' }),
    );
  });

  it('updates every lifecycle state and removes metadata', async () => {
    await repository.markUploaded(entity.id, 6, 'checksum');
    await repository.markDeleting(entity.id);
    await repository.markFailed(entity.id, 'FILE_DELETE_FAILED');
    await repository.recordDeleteFailure(entity.id, 'FILE_DELETE_FAILED');
    await repository.clearPendingMigrationSource(entity.id);
    await repository.removeMetadata(entity.id);
    expect(files.update).toHaveBeenCalledTimes(5);
    expect(files.delete).toHaveBeenCalledWith({ id: entity.id });
  });

  it('finds bounded cleanup and provider counts', async () => {
    files.find.mockResolvedValue([entity]);
    files.countBy.mockResolvedValue(3);
    await expect(repository.findCleanupCandidates(new Date(), 100)).resolves.toHaveLength(1);
    await expect(repository.countByProvider('local')).resolves.toBe(3);
  });

  it('builds restartable migration and pending-source queries', async () => {
    await expect(repository.findMigrationBatch('local', entity.id, 25)).resolves.toHaveLength(1);
    expect(query.andWhere).toHaveBeenCalledWith('file.id > :afterId', { afterId: entity.id });
    await expect(repository.findPendingMigrationSourceCleanup(25)).resolves.toHaveLength(1);
    expect(query.addOrderBy).toHaveBeenCalledWith('file.id', 'ASC');
  });

  it('atomically switches a provider and reports compare-and-swap failure', async () => {
    await expect(repository.switchProvider(entity.id, 'local', 's3', 'objects/id')).resolves.toBe(
      true,
    );
    files.update.mockResolvedValueOnce({ affected: 0 });
    await expect(repository.switchProvider(entity.id, 'local', 's3', 'objects/id')).resolves.toBe(
      false,
    );
  });

  it('serializes cleanup and migration work with advisory locks', async () => {
    await expect(repository.withCleanupLock(() => Promise.resolve('cleaned'))).resolves.toBe(
      'cleaned',
    );
    await expect(repository.withMigrationLock(() => Promise.resolve('migrated'))).resolves.toBe(
      'migrated',
    );
    expect(runner.connect).toHaveBeenCalledTimes(2);
    expect(runner.release).toHaveBeenCalledTimes(2);
    expect(runner.query).toHaveBeenCalledWith(
      "SELECT pg_advisory_lock(hashtext('files:migration'))",
    );
  });
});
