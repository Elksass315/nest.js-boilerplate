import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';

import { SEED_REGISTRY } from './seed.registry';
import type { SeedDefinition, SeedStatus } from './seed.types';

const SEED_LOCK_KEY = 'nestjs-saas:database-seeds';

interface SeedHistoryRow {
  id: string;
  checksum: string;
  executed_at: Date;
}

@Injectable()
export class SeedRunnerService {
  private readonly logger = new Logger(SeedRunnerService.name);

  public constructor(private readonly dataSource: DataSource) {}

  public async show(): Promise<SeedStatus[]> {
    return this.withLockedRunner(async (runner) => this.resolveStatuses(runner));
  }

  public async run(): Promise<SeedStatus[]> {
    return this.withLockedRunner(async (runner) => {
      const statuses = await this.resolveStatuses(runner);
      for (const status of statuses) {
        if (status.status === 'applied') {
          this.logger.log({ seedId: status.id }, 'Seed already applied; skipped');
          continue;
        }
        const seed = this.requireSeed(status.id);
        await runner.startTransaction();
        try {
          await seed.run(runner);
          await runner.query('INSERT INTO "app_seed_history" ("id", "checksum") VALUES ($1, $2)', [
            status.id,
            status.checksum,
          ]);
          await runner.commitTransaction();
          this.logger.log({ seedId: status.id }, 'Seed applied');
        } catch (error) {
          await runner.rollbackTransaction();
          throw error;
        }
      }
      return this.resolveStatuses(runner);
    });
  }

  private async withLockedRunner<T>(work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.query('SELECT pg_advisory_lock(hashtext($1))', [SEED_LOCK_KEY]);
      return await work(runner);
    } finally {
      await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [SEED_LOCK_KEY]);
      await runner.release();
    }
  }

  private async resolveStatuses(runner: QueryRunner): Promise<SeedStatus[]> {
    const rows = (await runner.query(
      'SELECT "id", "checksum", "executed_at" FROM "app_seed_history" ORDER BY "executed_at"',
    )) as SeedHistoryRow[];
    const history = new Map(rows.map((row) => [row.id, row]));

    return SEED_REGISTRY.map((seed) => {
      const checksum = this.checksum(seed);
      const applied = history.get(seed.id);
      if (applied && applied.checksum !== checksum) {
        throw new Error(
          `Applied seed "${seed.id}" has changed; create a new immutable seed instead`,
        );
      }
      return {
        id: seed.id,
        description: seed.description,
        checksum,
        status: applied ? 'applied' : 'pending',
        executedAt: applied?.executed_at ?? null,
      };
    });
  }

  private checksum(seed: SeedDefinition): string {
    return createHash('sha256')
      .update(JSON.stringify({ id: seed.id, source: seed.checksumSource }))
      .digest('hex');
  }

  private requireSeed(id: string): SeedDefinition {
    const seed = SEED_REGISTRY.find((candidate) => candidate.id === id);
    if (!seed) {
      throw new Error(`Seed "${id}" is not registered`);
    }
    return seed;
  }
}
