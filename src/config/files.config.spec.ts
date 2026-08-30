import path from 'node:path';

import { createFilesConfig, parseFileStorageDrivers } from './files.config';

describe('files configuration', () => {
  it('deduplicates storage drivers while preserving order', () => {
    expect(parseFileStorageDrivers('s3, local, s3')).toEqual(['s3', 'local']);
  });

  it('converts upload expiration hours to milliseconds', () => {
    const config = createFilesConfig({
      FILES_WRITE_DRIVER: 'local',
      FILES_READ_DRIVERS: 'local',
      FILES_METADATA_RETENTION_DAYS: 7,
      FILES_LOCAL_ROOT: 'C:/storage/files',
      FILES_UPLOAD_EXPIRATION_HOURS: 2,
      FILES_SIGNED_URL_TTL_SECONDS: 300,
      FILES_WORKER_CONCURRENCY: 5,
      FILES_MAX_RETRIES: 3,
      FILES_RETRY_DELAY_MS: 1000,
      FILES_USER_AVATAR_MAX_BYTES: 1024,
      FILES_USER_AVATAR_MAX_WIDTH: 100,
      FILES_USER_AVATAR_MAX_HEIGHT: 100,
      FILES_USER_AVATAR_MAX_PIXELS: 10000,
      FILES_S3_BUCKET: '',
      FILES_S3_REGION: 'us-east-1',
      FILES_S3_ENDPOINT: '',
      FILES_S3_FORCE_PATH_STYLE: false,
      FILES_S3_CDN_URL: '',
      FILES_S3_ACCESS_KEY_ID: '',
      FILES_S3_SECRET_ACCESS_KEY: '',
      FILES_S3_SERVER_SIDE_ENCRYPTION: 'AES256',
      FILES_S3_KMS_KEY_ID: '',
    });

    expect(config.uploadExpirationMs).toBe(7_200_000);
    expect(config.localRoot).toBe(path.resolve('C:/storage/files'));
    expect(config.readDrivers).toEqual(['local']);
  });

  it('rejects unknown storage drivers', () => {
    expect(() => parseFileStorageDrivers('local,ftp')).toThrow(
      'FILES_READ_DRIVERS must contain only local and s3',
    );
  });
});
