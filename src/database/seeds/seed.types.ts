import type { QueryRunner } from 'typeorm';

export interface SeedDefinition {
  id: string;
  description: string;
  checksumSource: unknown;
  run: (queryRunner: QueryRunner) => Promise<void>;
}

export interface SeedStatus {
  id: string;
  description: string;
  checksum: string;
  status: 'pending' | 'applied';
  executedAt: Date | null;
}
