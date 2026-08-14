import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSeedHistory1786492800000 implements MigrationInterface {
  public name = 'CreateSeedHistory1786492800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_seed_history" (
        "id" varchar(160) NOT NULL,
        "checksum" varchar(64) NOT NULL,
        "executed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_seed_history" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "app_seed_history"');
  }
}
