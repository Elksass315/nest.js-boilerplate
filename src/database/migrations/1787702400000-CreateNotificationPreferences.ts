import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationPreferences1787702400000 implements MigrationInterface {
  public readonly name = 'CreateNotificationPreferences1787702400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "notification_preferences" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "product_updates_email" boolean NOT NULL DEFAULT false, "marketing_email" boolean NOT NULL DEFAULT false, "version" integer NOT NULL DEFAULT 1, CONSTRAINT "CHK_notification_preferences_version" CHECK ("version" >= 1), CONSTRAINT "UQ_notification_preferences_user" UNIQUE ("user_id"), CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"), CONSTRAINT "FK_notification_preferences_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "notification_preferences"');
  }
}
