import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexSecurityAuditPagination1787184000000 implements MigrationInterface {
  public readonly name = 'IndexSecurityAuditPagination1787184000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_user_security_audits_user_created"');
    await queryRunner.query(
      'CREATE INDEX "IDX_user_security_audits_user_created_id" ON "user_security_audits" ("user_id", "created_at", "id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_user_security_audits_user_created_id"');
    await queryRunner.query(
      'CREATE INDEX "IDX_user_security_audits_user_created" ON "user_security_audits" ("user_id", "created_at")',
    );
  }
}
