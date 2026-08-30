import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropLegacyUserAvatarColumn1787800000000 implements MigrationInterface {
  public name = 'DropLegacyUserAvatarColumn1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP CONSTRAINT "FK_users_avatar_file"');
    await queryRunner.query('ALTER TABLE "users" DROP CONSTRAINT "UQ_users_avatar_file_id"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "avatar_file_id"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD "avatar_file_id" uuid');
    await queryRunner.query(
      'ALTER TABLE "users" ADD CONSTRAINT "UQ_users_avatar_file_id" UNIQUE ("avatar_file_id")',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD CONSTRAINT "FK_users_avatar_file" FOREIGN KEY ("avatar_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL',
    );
    await queryRunner.query(`
      UPDATE "users" AS "user"
      SET "avatar_file_id" = "association"."file_id"
      FROM "user_avatar_associations" AS "association"
      WHERE "association"."user_id" = "user"."id"
    `);
  }
}
