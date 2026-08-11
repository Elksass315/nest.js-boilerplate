import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentityCore1786579200000 implements MigrationInterface {
  public name = 'CreateIdentityCore1786579200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "authorization_roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "key" varchar(64) NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" varchar(240) NOT NULL,
        "is_system" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_authorization_roles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_authorization_roles_key" UNIQUE ("key")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "authorization_permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "key" varchar(100) NOT NULL,
        "description" varchar(240) NOT NULL,
        CONSTRAINT "PK_authorization_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_authorization_permissions_key" UNIQUE ("key")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "authorization_role_permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_authorization_role_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_authorization_role_permissions_pair" UNIQUE ("role_id", "permission_id"),
        CONSTRAINT "FK_authorization_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "authorization_roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_authorization_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "authorization_permissions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_authorization_role_permissions_permission" ON "authorization_role_permissions" ("permission_id")',
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "full_name" varchar(160) NOT NULL,
        "email" varchar(320) NOT NULL,
        "normalized_email" varchar(320) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'pending_verification',
        "email_verified_at" timestamptz,
        "email_two_step_enabled" boolean NOT NULL DEFAULT false,
        "auth_version" integer NOT NULL DEFAULT 1,
        "failed_login_count" integer NOT NULL DEFAULT 0,
        "locked_until" timestamptz,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_normalized_email" UNIQUE ("normalized_email"),
        CONSTRAINT "CHK_users_status" CHECK ("status" IN ('pending_verification', 'active', 'suspended')),
        CONSTRAINT "CHK_users_auth_version" CHECK ("auth_version" >= 1),
        CONSTRAINT "CHK_users_failed_login_count" CHECK ("failed_login_count" >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_users_status_created_at" ON "users" ("status", "created_at")',
    );
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_roles_pair" UNIQUE ("user_id", "role_id"),
        CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "authorization_roles"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_user_roles_role_id" ON "user_roles" ("role_id")');
    await queryRunner.query(`
      CREATE TABLE "user_security_audits" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid,
        "actor_user_id" uuid,
        "event_type" varchar(100) NOT NULL,
        "request_id" varchar(160),
        "correlation_id" varchar(160),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_user_security_audits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_security_audits_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_user_security_audits_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_user_security_audits_user_created" ON "user_security_audits" ("user_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_security_audits_correlation" ON "user_security_audits" ("correlation_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_security_audits"');
    await queryRunner.query('DROP TABLE "user_roles"');
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TABLE "authorization_role_permissions"');
    await queryRunner.query('DROP TABLE "authorization_permissions"');
    await queryRunner.query('DROP TABLE "authorization_roles"');
  }
}
