import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

import { CAPABILITY_API_IMPORTS, CAPABILITY_API_PROVIDERS } from './api/capability-composition';
import { CAPABILITY_WORKER_IMPORTS } from './capability-worker-imports';
import { CAPABILITY_MAINTENANCE_PROVIDERS } from './maintenance-worker/capability-composition';
import { MAINTENANCE_CAPABILITY_CLEANER } from './maintenance-worker/maintenance-capability-cleaner';
import { CAPABILITY_OUTBOX_PROVIDERS } from './outbox-worker/capability-composition';
import { OUTBOX_CAPABILITY_PUBLISHER } from '@/core/outbox/outbox-capability-publisher';
import { FilesService } from '@/modules/files';
import { OUTBOX_FILE_QUEUE } from '@/core/outbox/outbox.types';
import { OutboxMessageEntity } from '@/core/outbox/outbox.entity';

describe('generated capability composition', () => {
  it('registers the selected API capability contributions', () => {
    expect(CAPABILITY_API_IMPORTS).toHaveLength(5);
    expect(CAPABILITY_API_PROVIDERS).toHaveLength(1);
    expect(CAPABILITY_WORKER_IMPORTS).toHaveLength(1);
  });

  it('builds the maintenance cleaner from platform dependencies', async () => {
    const files = { cleanupTemporaryMetadata: jest.fn().mockResolvedValue(3) };
    const module = await Test.createTestingModule({
      providers: [
        ...CAPABILITY_MAINTENANCE_PROVIDERS,
        { provide: FilesService, useValue: files },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue(14) },
        },
      ],
    }).compile();

    const cleaner = module.get(MAINTENANCE_CAPABILITY_CLEANER);
    await expect(cleaner.cleanup(new Date('2026-01-15T00:00:00.000Z'), 10)).resolves.toBe(3);
    expect(files.cleanupTemporaryMetadata).toHaveBeenCalledWith(
      new Date('2026-01-01T00:00:00.000Z'),
      10,
    );
  });

  it('publishes supported file outbox topics through the generated queue provider', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        ...CAPABILITY_OUTBOX_PROVIDERS,
        { provide: getQueueToken(OUTBOX_FILE_QUEUE), useValue: queue },
      ],
    }).compile();

    const publisher = module.get(OUTBOX_CAPABILITY_PUBLISHER);
    expect(publisher.supports('file.delete')).toBe(true);
    expect(publisher.supports('mail.send')).toBe(false);
    const record = Object.assign(new OutboxMessageEntity(), {
      id: 'message-id',
      topic: 'file.delete',
      payload: { key: 'file-key' },
    });
    await publisher.publish(record);
    expect(queue.add).toHaveBeenCalledWith(
      'files.physical-delete',
      { key: 'file-key' },
      expect.objectContaining({ jobId: 'message-id' }),
    );
    await publisher.close();
    expect(queue.close).toHaveBeenCalled();

    await publisher.publish(
      Object.assign(new OutboxMessageEntity(), {
        id: 'migration-id',
        topic: 'file.migration-source-delete',
        payload: { key: 'source-key' },
      }),
    );
    expect(queue.add).toHaveBeenLastCalledWith(
      'files.migration-source-delete',
      { key: 'source-key' },
      expect.objectContaining({ jobId: 'migration-id' }),
    );
  });
});
