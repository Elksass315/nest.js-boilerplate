import type { DataSource, QueryRunner } from 'typeorm';

import { SEED_REGISTRY } from './seed.registry';
import { SeedRunnerService } from './seed-runner.service';
import type { SeedDefinition } from './seed.types';

describe(SeedRunnerService.name, () => {
  const registry = SEED_REGISTRY as SeedDefinition[];
  const registeredSeeds = [...registry];

  beforeEach(() => {
    registry.length = 0;
  });

  afterEach(() => {
    registry.splice(0, registry.length, ...registeredSeeds);
  });

  function createHarness(): {
    history: { id: string; checksum: string; executed_at: Date }[];
    runner: jest.Mocked<QueryRunner>;
    service: SeedRunnerService;
  } {
    const history: { id: string; checksum: string; executed_at: Date }[] = [];
    const query = jest.fn((sql: string, parameters?: unknown[]): Promise<unknown> => {
      if (sql.startsWith('SELECT "id"')) {
        return Promise.resolve(history);
      }
      if (sql.startsWith('INSERT')) {
        history.push({
          id: String(parameters?.[0]),
          checksum: String(parameters?.[1]),
          executed_at: new Date('2026-08-12T00:00:00.000Z'),
        });
      }
      return Promise.resolve([]);
    });
    const runner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query,
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
    const dataSource = { createQueryRunner: jest.fn(() => runner) } as unknown as DataSource;
    return { history, runner, service: new SeedRunnerService(dataSource) };
  }

  it('locks and reports pending immutable seeds', async () => {
    registry.push({
      id: '001-foundation',
      description: 'Foundation data',
      checksumSource: 'v1',
      run: jest.fn(),
    });
    const { runner, service } = createHarness();

    await expect(service.show()).resolves.toEqual([
      expect.objectContaining({ id: '001-foundation', status: 'pending', executedAt: null }),
    ]);
    expect(runner.connect).toHaveBeenCalledTimes(1);
    expect(runner.query).toHaveBeenCalledWith('SELECT pg_advisory_lock(hashtext($1))', [
      'nestjs-saas:database-seeds',
    ]);
    expect(runner.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock(hashtext($1))', [
      'nestjs-saas:database-seeds',
    ]);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('applies each pending seed in its own transaction and records the checksum', async () => {
    const seedRun = jest.fn().mockResolvedValue(undefined);
    registry.push({
      id: '001-foundation',
      description: 'Foundation data',
      checksumSource: 'v1',
      run: seedRun,
    });
    const { runner, service } = createHarness();

    await expect(service.run()).resolves.toEqual([
      expect.objectContaining({ id: '001-foundation', status: 'applied' }),
    ]);
    expect(seedRun).toHaveBeenCalledWith(runner);
    expect(runner.startTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rejects checksum drift for an already applied seed', async () => {
    registry.push({
      id: '001-foundation',
      description: 'Foundation data',
      checksumSource: 'changed',
      run: jest.fn(),
    });
    const { history, runner, service } = createHarness();
    history.push({ id: '001-foundation', checksum: 'old-checksum', executed_at: new Date() });

    await expect(service.show()).rejects.toThrow('has changed');
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back a failing seed and still releases the advisory lock', async () => {
    registry.push({
      id: '001-foundation',
      description: 'Foundation data',
      checksumSource: 'v1',
      run: jest.fn().mockRejectedValue(new Error('seed failed')),
    });
    const { runner, service } = createHarness();

    await expect(service.run()).rejects.toThrow('seed failed');
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });
});
