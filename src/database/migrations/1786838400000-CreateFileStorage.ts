import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFileStorage1786838400000 implements MigrationInterface {
  public name = 'CreateFileStorage1786838400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "stored_files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "public_id" uuid NOT NULL,
        "provider" varchar(16) NOT NULL,
        "storage_key" varchar(512) NOT NULL,
        "original_name" varchar(255) NOT NULL,
        "mime_type" varchar(180) NOT NULL,
        "size_bytes" bigint NOT NULL,
        "checksum_sha256" varchar(64),
        "visibility" varchar(16) NOT NULL DEFAULT 'protected',
        "status" varchar(16) NOT NULL DEFAULT 'uploading',
        "purpose" varchar(100) NOT NULL,
        "uploaded_by" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "completed_at" timestamptz,
        "claimed_at" timestamptz,
        "delete_requested_at" timestamptz,
        "failure_code" varchar(100),
        "pending_delete_provider" varchar(16),
        "pending_delete_storage_key" varchar(512),
        "request_id" varchar(128) NOT NULL,
        "correlation_id" varchar(128) NOT NULL,
        CONSTRAINT "PK_stored_files" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_stored_files_public_id" UNIQUE ("public_id"),
        CONSTRAINT "UQ_stored_files_provider_key" UNIQUE ("provider", "storage_key"),
        CONSTRAINT "CHK_stored_files_provider" CHECK ("provider" IN ('local', 's3')),
        CONSTRAINT "CHK_stored_files_visibility" CHECK ("visibility" IN ('protected', 'public')),
        CONSTRAINT "CHK_stored_files_status" CHECK ("status" IN ('uploading', 'uploaded', 'ready', 'deleting', 'failed')),
        CONSTRAINT "CHK_stored_files_size" CHECK ("size_bytes" >= 0),
        CONSTRAINT "CHK_stored_files_pending_delete_provider" CHECK ("pending_delete_provider" IS NULL OR "pending_delete_provider" IN ('local', 's3')),
        CONSTRAINT "CHK_stored_files_pending_delete_pair" CHECK (("pending_delete_provider" IS NULL) = ("pending_delete_storage_key" IS NULL)),
        CONSTRAINT "FK_stored_files_uploader" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_stored_files_uploader_status" ON "stored_files" ("uploaded_by", "status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_stored_files_expiration" ON "stored_files" ("status", "expires_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "stored_files"');
  }
}
