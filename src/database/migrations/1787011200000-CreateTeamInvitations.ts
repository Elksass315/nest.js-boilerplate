import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeamInvitations1787011200000 implements MigrationInterface {
  public readonly name = 'CreateTeamInvitations1787011200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "team_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "email" varchar(320) NOT NULL,
        "normalized_email" varchar(320) NOT NULL,
        "role_id" uuid NOT NULL,
        "role_key" varchar(64) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "token_hash" varchar(64) NOT NULL,
        "invited_by_user_id" uuid NOT NULL,
        "accepted_by_user_id" uuid,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "revoked_at" timestamptz,
        "last_sent_at" timestamptz NOT NULL,
        "send_count" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_team_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_team_invitations_status" CHECK ("status" IN ('pending', 'accepted', 'expired', 'revoked')),
        CONSTRAINT "CHK_team_invitations_send_count" CHECK ("send_count" >= 1),
        CONSTRAINT "FK_team_invitations_role" FOREIGN KEY ("role_id") REFERENCES "authorization_roles"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_team_invitations_inviter" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_team_invitations_acceptor" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_team_invitations_pending_email" ON "team_invitations" ("normalized_email") WHERE "status" = \'pending\'',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_team_invitations_status_created" ON "team_invitations" ("status", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_team_invitations_normalized_email" ON "team_invitations" ("normalized_email")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_team_invitations_expires_at" ON "team_invitations" ("status", "expires_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "team_invitations"');
  }
}
