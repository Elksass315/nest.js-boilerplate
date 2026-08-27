import { swaggerErrorContent, swaggerErrorExample } from '@/common/swagger/api-error-response';
import type { ErrorCode } from '@/core/errors/error-definitions';

export const AUTH_PATH = '/api/v1/auth';
export const SESSIONS_PATH = '/api/v1/sessions';

export function errorContent(
  code: ErrorCode,
  path: string,
  details?: Record<string, unknown>,
): Record<string, { example: Record<string, unknown> }> {
  return swaggerErrorContent(code, path, details);
}

export function errorExample(code: ErrorCode, path: string): Record<string, unknown> {
  return swaggerErrorExample(code, path);
}

export const messageContent = (
  message: string,
): Record<string, { example: { message: string } }> => ({
  'application/json': { example: { message } },
});

export const tokenPairContent = {
  'application/json': {
    example: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.signature',
      refreshToken: 'cmVmcmVzaC10b2tlbi1leGFtcGxlLTEyMzQ1Njc4OTA',
      tokenType: 'Bearer',
      expiresIn: 900,
    },
  },
};

export const loginSuccessContent = {
  'application/json': {
    example: {
      ...tokenPairContent['application/json'].example,
      user: {
        id: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
        fullName: 'Amina Hassan',
        email: 'amina@example.com',
        status: 'active',
        emailVerifiedAt: '2026-08-12T10:00:00.000Z',
        emailTwoStepEnabled: false,
        emailTwoStepRequired: false,
        roles: ['user'],
        permissions: [],
        avatar: null,
        createdAt: '2026-08-12T09:45:00.000Z',
        updatedAt: '2026-08-12T10:05:00.000Z',
      },
    },
  },
};
