import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeatureFlags1787270400000 implements MigrationInterface {
  public readonly name = 'CreateFeatureFlags1787270400000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "feature_flags" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "key" character varying(100) NOT NULL, "description" character varying(500) NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "version" integer NOT NULL DEFAULT 1, "updated_by_user_id" uuid NOT NULL, CONSTRAINT "CHK_feature_flags_version" CHECK ("version" >= 1), CONSTRAINT "UQ_feature_flags_key" UNIQUE ("key"), CONSTRAINT "PK_feature_flags" PRIMARY KEY ("id"), CONSTRAINT "FK_feature_flags_updated_by_user" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT)',
    );
    await queryRunner.query(
      'CREATE TABLE "feature_flag_audits" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "feature_flag_id" uuid NOT NULL, "actor_user_id" uuid NOT NULL, "previous_enabled" boolean, "enabled" boolean NOT NULL, "request_id" character varying(128), "correlation_id" character varying(128), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_feature_flag_audits" PRIMARY KEY ("id"), CONSTRAINT "FK_feature_flag_audits_flag" FOREIGN KEY ("feature_flag_id") REFERENCES "feature_flags"("id") ON DELETE RESTRICT, CONSTRAINT "FK_feature_flag_audits_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT)',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_feature_flag_audits_flag_created" ON "feature_flag_audits" ("feature_flag_id", "created_at", "id")',
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "feature_flag_audits"');
    await queryRunner.query('DROP TABLE "feature_flags"');
  }
}
