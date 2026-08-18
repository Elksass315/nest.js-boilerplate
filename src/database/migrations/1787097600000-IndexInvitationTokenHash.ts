import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexInvitationTokenHash1787097600000 implements MigrationInterface {
  public readonly name = 'IndexInvitationTokenHash1787097600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_team_invitations_token_hash" ON "team_invitations" ("token_hash")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_team_invitations_token_hash"');
  }
}
