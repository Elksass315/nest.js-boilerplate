import type { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import type { AppConfiguration } from '@/config/configuration.types';
import { AppException } from '@/core/errors/app.exception';
import type { UploadedFileContent } from '@/modules/files';

import { assertSafeAvatarMetadata, AvatarImageService } from './avatar-image.service';

describe(AvatarImageService.name, () => {
  const limits = { maxBytes: 5_242_880, maxWidth: 128, maxHeight: 128, maxPixels: 16_384 };
  const config = {
    getOrThrow: jest.fn(() => ({ userAvatar: limits })),
  } as unknown as ConfigService<AppConfiguration, true>;
  const service = new AvatarImageService(config);

  it('re-encodes a valid image in the same format without source metadata', async () => {
    const source = await sharp({
      create: { width: 32, height: 24, channels: 4, background: '#336699' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'remove-me' } } })
      .toBuffer();

    const result = await service.sanitize(content(source, 'portrait.jpg', 'image/jpeg'));
    const metadata = await sharp(result.bytes).metadata();

    expect(result.mimeType).toBe('image/jpeg');
    expect(metadata.format).toBe('jpeg');
    expect(metadata.exif).toBeUndefined();
  });

  it('rejects deceptive extensions and malformed image bytes', async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 4, background: '#ffffff' },
    })
      .png()
      .toBuffer();

    await expect(service.sanitize(content(png, 'avatar.jpg', 'image/jpeg'))).rejects.toBeInstanceOf(
      AppException,
    );
    await expect(
      service.sanitize(content(Buffer.from('not-an-image'), 'avatar.png', 'image/png')),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('rejects excessive dimensions and animated metadata', async () => {
    const oversized = await sharp({
      create: { width: 129, height: 10, channels: 4, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    await expect(
      service.sanitize(content(oversized, 'avatar.png', 'image/png')),
    ).rejects.toBeInstanceOf(AppException);
    expect(() => {
      assertSafeAvatarMetadata({ width: 16, height: 16, pages: 2 }, limits);
    }).toThrow(AppException);
  });
});

function content(
  bytes: Buffer,
  originalName: string,
  declaredMimeType: string,
): UploadedFileContent {
  return { fileId: 'file-1', originalName, declaredMimeType, sizeBytes: bytes.byteLength, bytes };
}
