import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatar1786924800000 implements MigrationInterface {
  public name = 'AddUserAvatar1786924800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD "avatar_file_id" uuid');
    await queryRunner.query(
      'ALTER TABLE "users" ADD CONSTRAINT "UQ_users_avatar_file_id" UNIQUE ("avatar_file_id")',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD CONSTRAINT "FK_users_avatar_file" FOREIGN KEY ("avatar_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP CONSTRAINT "FK_users_avatar_file"');
    await queryRunner.query('ALTER TABLE "users" DROP CONSTRAINT "UQ_users_avatar_file_id"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "avatar_file_id"');
  }
}
