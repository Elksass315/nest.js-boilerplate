import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailVerificationCodes1787356800000 implements MigrationInterface {
  public readonly name = 'CreateEmailVerificationCodes1787356800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "auth_action_tokens" WHERE "purpose" = 'email_verification'`,
    );
    await queryRunner.query(
      'ALTER TABLE "auth_action_tokens" DROP CONSTRAINT "CHK_auth_action_tokens_purpose"',
    );
    await queryRunner.query(
      `ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "CHK_auth_action_tokens_purpose" CHECK ("purpose" = 'password_reset')`,
    );
    await queryRunner.query(`
      CREATE TABLE "auth_email_verification_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "code_hash" varchar(255) NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        CONSTRAINT "PK_auth_email_verification_codes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_auth_email_verification_codes_attempts" CHECK ("attempts" >= 0),
        CONSTRAINT "FK_auth_email_verification_codes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_email_verification_codes_user_active" ON "auth_email_verification_codes" ("user_id", "consumed_at", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_email_verification_codes"');
    await queryRunner.query(
      'ALTER TABLE "auth_action_tokens" DROP CONSTRAINT "CHK_auth_action_tokens_purpose"',
    );
    await queryRunner.query(
      `ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "CHK_auth_action_tokens_purpose" CHECK ("purpose" IN ('email_verification', 'password_reset'))`,
    );
  }
}
