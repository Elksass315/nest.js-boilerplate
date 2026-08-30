import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPermissionOverrides1787529600000 implements MigrationInterface {
  public name = 'CreateUserPermissionOverrides1787529600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_permission_overrides" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        "effect" varchar(16) NOT NULL,
        CONSTRAINT "PK_user_permission_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_permission_overrides_user_permission" UNIQUE ("user_id", "permission_id"),
        CONSTRAINT "CHK_user_permission_overrides_effect" CHECK ("effect" IN ('grant', 'revoke')),
        CONSTRAINT "FK_user_permission_overrides_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_permission_overrides_permission" FOREIGN KEY ("permission_id") REFERENCES "authorization_permissions"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_user_permission_overrides_permission_id" ON "user_permission_overrides" ("permission_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_permission_overrides"');
  }
}
