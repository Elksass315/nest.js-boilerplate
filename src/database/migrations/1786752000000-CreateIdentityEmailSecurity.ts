import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentityEmailSecurity1786752000000 implements MigrationInterface {
  public name = 'CreateIdentityEmailSecurity1786752000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_two_step_challenges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "purpose" varchar(32) NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "code_hash" varchar(255) NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        CONSTRAINT "PK_auth_two_step_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_two_step_challenges_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "CHK_auth_two_step_challenges_purpose" CHECK ("purpose" IN ('login', 'enable', 'disable', 'recovery_regenerate')),
        CONSTRAINT "CHK_auth_two_step_challenges_attempts" CHECK ("attempts" >= 0),
        CONSTRAINT "FK_auth_two_step_challenges_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_two_step_challenges_user_purpose" ON "auth_two_step_challenges" ("user_id", "purpose", "consumed_at")',
    );
    await queryRunner.query(`
      CREATE TABLE "auth_recovery_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "code_hash" varchar(255) NOT NULL,
        "consumed_at" timestamptz,
        CONSTRAINT "PK_auth_recovery_codes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_recovery_codes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_recovery_codes_user_available" ON "auth_recovery_codes" ("user_id", "consumed_at")',
    );
    await queryRunner.query(`
      CREATE TABLE "mail_deliveries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "recipient_hash" varchar(64) NOT NULL,
        "masked_recipient" varchar(320) NOT NULL,
        "template" varchar(64) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'queued',
        "attempts" integer NOT NULL DEFAULT 0,
        "provider" varchar(64),
        "error_code" varchar(100),
        "correlation_id" varchar(128),
        "sent_at" timestamptz,
        CONSTRAINT "PK_mail_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_mail_deliveries_status" CHECK ("status" IN ('queued', 'processing', 'sent', 'failed')),
        CONSTRAINT "CHK_mail_deliveries_attempts" CHECK ("attempts" >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_mail_deliveries_status_created" ON "mail_deliveries" ("status", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_mail_deliveries_recipient_hash" ON "mail_deliveries" ("recipient_hash", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "mail_deliveries"');
    await queryRunner.query('DROP TABLE "auth_recovery_codes"');
    await queryRunner.query('DROP TABLE "auth_two_step_challenges"');
  }
}
