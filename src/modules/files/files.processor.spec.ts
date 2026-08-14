import type { Job } from 'bullmq';
import type { PinoLogger } from 'nestjs-pino';

import type { FilesService } from './files.service';
import { FilesProcessor } from './files.processor';
import { FILE_DELETE_JOB, FILE_SWEEP_JOB, type FileJob } from './files.types';

describe(FilesProcessor.name, () => {
  const files = {
    deletePhysicalFile: jest.fn(),
    deleteMigrationSource: jest.fn(),
    sweepExpired: jest.fn(),
  };
  const logger = { setContext: jest.fn(), info: jest.fn(), error: jest.fn() };
  let processor: FilesProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new FilesProcessor(
      files as unknown as FilesService,
      logger as unknown as PinoLogger,
    );
  });

  it('deletes a correlated file idempotently', async () => {
    await processor.process(job(FILE_DELETE_JOB, { fileId: 'file-1', correlationId: 'corr-1' }));
    expect(files.deletePhysicalFile).toHaveBeenCalledWith('file-1');
  });

  it('runs the periodic cleanup sweep', async () => {
    files.sweepExpired.mockResolvedValue(2);
    await processor.process(job(FILE_SWEEP_JOB, { correlationId: 'corr-sweep' }));
    expect(files.sweepExpired).toHaveBeenCalledWith('corr-sweep');
  });

  it('rethrows deletion failures for BullMQ retry', async () => {
    files.deletePhysicalFile.mockRejectedValue(new Error('storage down'));
    await expect(
      processor.process(job(FILE_DELETE_JOB, { fileId: 'file-1', correlationId: 'corr-1' })),
    ).rejects.toThrow('File deletion failed');
    expect(logger.error).toHaveBeenCalled();
  });
});

function job(name: string, data: FileJob): Job<FileJob> {
  return { name, data, id: 'job-1', attemptsMade: 0 } as Job<FileJob>;
}
