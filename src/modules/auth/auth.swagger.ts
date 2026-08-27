export const AUTH_PATH = '/api/v1/auth';
export const SESSIONS_PATH = '/api/v1/sessions';

export function errorContent(
  statusCode: number,
  code: string,
  message: string,
  path: string,
  details?: Record<string, unknown>,
): Record<string, { example: Record<string, unknown> }> {
  return {
    'application/json': {
      example: {
        statusCode,
        code,
        message,
        timestamp: '2026-08-12T12:00:00.000Z',
        path,
        requestId: 'req_auth_example',
        correlationId: 'corr_auth_example',
        ...(details ? { details } : {}),
      },
    },
  };
}

export function errorExample(
  statusCode: number,
  code: string,
  message: string,
  path: string,
): Record<string, unknown> {
  return errorContent(statusCode, code, message, path)['application/json']?.example ?? {};
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
