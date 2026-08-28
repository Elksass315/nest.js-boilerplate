import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransactionalOutbox1787600000000 implements MigrationInterface {
  public name = 'CreateTransactionalOutbox1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "topic" varchar(64) NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "payload" jsonb NOT NULL,
        "correlation_id" varchar(128) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "available_at" timestamptz NOT NULL DEFAULT now(),
        "lease_until" timestamptz,
        "lease_token" uuid,
        "last_error_code" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_outbox_messages_topic" CHECK ("topic" IN ('mail.send', 'file.delete', 'file.migration-source-delete')),
        CONSTRAINT "CHK_outbox_messages_status" CHECK ("status" IN ('pending', 'processing', 'published', 'failed')),
        CONSTRAINT "CHK_outbox_messages_attempts" CHECK ("attempts" >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_outbox_messages_claim" ON "outbox_messages" ("status", "available_at", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "outbox_messages"');
  }
}
