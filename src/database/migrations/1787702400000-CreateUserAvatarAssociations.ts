import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAvatarAssociations1787702400000 implements MigrationInterface {
  public name = 'CreateUserAvatarAssociations1787702400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_avatar_associations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "file_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_avatar_associations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_avatar_associations_user_id" UNIQUE ("user_id"),
        CONSTRAINT "UQ_user_avatar_associations_file_id" UNIQUE ("file_id"),
        CONSTRAINT "FK_user_avatar_associations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_avatar_associations_file" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_user_avatar_associations_file_id" ON "user_avatar_associations" ("file_id")',
    );
    await queryRunner.query(`
      INSERT INTO "user_avatar_associations" ("user_id", "file_id")
      SELECT "id", "avatar_file_id" FROM "users"
      WHERE "avatar_file_id" IS NOT NULL
      ON CONFLICT ("user_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_user_avatar_associations_file_id"');
    await queryRunner.query('DROP TABLE "user_avatar_associations"');
  }
}
