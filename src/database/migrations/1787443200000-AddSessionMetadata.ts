import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionMetadata1787443200000 implements MigrationInterface {
  public name = 'AddSessionMetadata1787443200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth_sessions" ADD "ip_address" varchar(64), ADD "user_agent" varchar(512), ADD "device_metadata" jsonb, ADD "approximate_location" jsonb',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth_sessions" DROP COLUMN "approximate_location", DROP COLUMN "device_metadata", DROP COLUMN "user_agent", DROP COLUMN "ip_address"',
    );
  }
}
