import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSessions1786665600000 implements MigrationInterface {
  public name = 'CreateAuthSessions1786665600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "auth_version" integer NOT NULL,
        "last_used_at" timestamptz NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "revoke_reason" varchar(40),
        CONSTRAINT "PK_auth_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_auth_sessions_auth_version" CHECK ("auth_version" >= 1),
        CONSTRAINT "FK_auth_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_sessions_user_active" ON "auth_sessions" ("user_id", "revoked_at", "last_used_at")',
    );
    await queryRunner.query(`
      CREATE TABLE "auth_refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "session_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "expires_at" timestamptz NOT NULL,
        CONSTRAINT "PK_auth_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_refresh_tokens_hash" UNIQUE ("token_hash"),
        CONSTRAINT "CHK_auth_refresh_tokens_status" CHECK ("status" IN ('active', 'rotated', 'revoked')),
        CONSTRAINT "FK_auth_refresh_tokens_session" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_refresh_tokens_session_status" ON "auth_refresh_tokens" ("session_id", "status")',
    );
    await queryRunner.query(`
      CREATE TABLE "auth_action_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "purpose" varchar(32) NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        CONSTRAINT "PK_auth_action_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_action_tokens_hash" UNIQUE ("token_hash"),
        CONSTRAINT "CHK_auth_action_tokens_purpose" CHECK ("purpose" IN ('email_verification', 'password_reset')),
        CONSTRAINT "FK_auth_action_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_action_tokens_user_purpose" ON "auth_action_tokens" ("user_id", "purpose", "consumed_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_action_tokens"');
    await queryRunner.query('DROP TABLE "auth_refresh_tokens"');
    await queryRunner.query('DROP TABLE "auth_sessions"');
  }
}
