import path from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import type { AppConfiguration } from '@/config/configuration.types';
import { AppException } from '@/core/errors/app.exception';
import type { UploadedFileContent } from '@/modules/files';

export interface SanitizedAvatar {
  bytes: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

const MIME_BY_EXTENSION: Readonly<Record<string, SanitizedAvatar['mimeType']>> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@Injectable()
export class AvatarImageService {
  private readonly limits: AppConfiguration['files']['userAvatar'];

  public constructor(config: ConfigService<AppConfiguration, true>) {
    this.limits = config.getOrThrow('files', { infer: true }).userAvatar;
  }

  public getLimits(): Readonly<AppConfiguration['files']['userAvatar']> {
    return this.limits;
  }

  public async sanitize(content: UploadedFileContent): Promise<SanitizedAvatar> {
    if (content.sizeBytes > this.limits.maxBytes) throw new AppException('FILE_TOO_LARGE');
    const extensionMime = MIME_BY_EXTENSION[path.extname(content.originalName).toLowerCase()];
    if (!extensionMime || extensionMime !== content.declaredMimeType) {
      throw new AppException('FILE_TYPE_NOT_ALLOWED');
    }

    try {
      const options = {
        animated: true,
        failOn: 'error' as const,
        limitInputPixels: this.limits.maxPixels,
      };
      const metadata = await sharp(content.bytes, options).metadata();
      if (!isSupportedFormat(metadata.format)) {
        throw new AppException('FILE_TYPE_NOT_ALLOWED');
      }
      const detectedMime = MIME_BY_FORMAT[metadata.format];
      if (detectedMime !== extensionMime) {
        throw new AppException('FILE_TYPE_NOT_ALLOWED');
      }
      assertSafeAvatarMetadata(metadata, this.limits);

      const image = sharp(content.bytes, {
        failOn: 'error',
        limitInputPixels: this.limits.maxPixels,
      }).rotate();
      const bytes = await encodeSameFormat(image, detectedMime);
      return { bytes, mimeType: detectedMime };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException('FILE_INVALID_IMAGE');
    }
  }
}

function isSupportedFormat(value: string): value is keyof typeof MIME_BY_FORMAT {
  return Object.hasOwn(MIME_BY_FORMAT, value);
}

interface AvatarMetadata {
  pages?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

export function assertSafeAvatarMetadata(
  metadata: AvatarMetadata,
  limits: Readonly<AppConfiguration['files']['userAvatar']>,
): void {
  if (
    (metadata.pages ?? 1) > 1 ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > limits.maxWidth ||
    metadata.height > limits.maxHeight ||
    metadata.width * metadata.height > limits.maxPixels
  ) {
    throw new AppException('FILE_INVALID_IMAGE');
  }
}

function encodeSameFormat(
  image: ReturnType<typeof sharp>,
  mimeType: SanitizedAvatar['mimeType'],
): Promise<Buffer> {
  if (mimeType === 'image/jpeg') {
    return image.jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();
  }
  if (mimeType === 'image/png') return image.png({ compressionLevel: 9 }).toBuffer();
  return image.webp({ quality: 90 }).toBuffer();
}
