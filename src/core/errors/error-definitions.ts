import { HttpStatus } from '@nestjs/common';

export const ERROR_DEFINITIONS = {
  BAD_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    messageKey: 'errors.badRequest',
    fallbackMessage: 'The request could not be processed',
  },
  VALIDATION_ERROR: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    messageKey: 'errors.validationFailed',
    fallbackMessage: 'Input validation failed',
  },
  RESOURCE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    messageKey: 'errors.resourceNotFound',
    fallbackMessage: 'The requested resource was not found',
  },
  RESOURCE_CONFLICT: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.resourceConflict',
    fallbackMessage: 'The request conflicts with the current resource state',
  },
  USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    messageKey: 'errors.userNotFound',
    fallbackMessage: 'The requested user was not found',
  },
  ROLE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    messageKey: 'errors.roleNotFound',
    fallbackMessage: 'One or more requested roles were not found',
  },
  EMAIL_ALREADY_REGISTERED: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.emailAlreadyRegistered',
    fallbackMessage: 'An account with this email already exists',
  },
  LAST_SUPER_ADMIN: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.lastSuperAdmin',
    fallbackMessage: 'At least one active super administrator must remain',
  },
  INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.invalidCredentials',
    fallbackMessage: 'Email or password is incorrect',
  },
  ACCOUNT_LOCKED: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.accountLocked',
    fallbackMessage: 'The account is temporarily locked',
  },
  INVALID_OR_EXPIRED_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.invalidOrExpiredToken',
    fallbackMessage: 'The token is invalid or has expired',
  },
  INVALID_REFRESH_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.invalidRefreshToken',
    fallbackMessage: 'The refresh token is invalid or expired',
  },
  REFRESH_TOKEN_REUSED: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.refreshTokenReused',
    fallbackMessage: 'Refresh token reuse was detected and the session was revoked',
  },
  INVALID_TWO_STEP_CHALLENGE: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.invalidTwoStepChallenge',
    fallbackMessage: 'The two-step challenge is invalid or has expired',
  },
  INVALID_TWO_STEP_CODE: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.invalidTwoStepCode',
    fallbackMessage: 'The two-step verification code is incorrect',
  },
  INVALID_RECOVERY_CODE: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.invalidRecoveryCode',
    fallbackMessage: 'The recovery code is invalid or has already been used',
  },
  TWO_STEP_ATTEMPTS_EXCEEDED: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.twoStepAttemptsExceeded',
    fallbackMessage: 'Too many two-step verification attempts',
  },
  TWO_STEP_ALREADY_ENABLED: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.twoStepAlreadyEnabled',
    fallbackMessage: 'Email two-step verification is already enabled',
  },
  TWO_STEP_NOT_ENABLED: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.twoStepNotEnabled',
    fallbackMessage: 'Email two-step verification is not enabled',
  },
  EMAIL_NOT_VERIFIED: {
    status: HttpStatus.FORBIDDEN,
    messageKey: 'errors.emailNotVerified',
    fallbackMessage: 'Verify the email address before signing in',
  },
  ACCOUNT_SUSPENDED: {
    status: HttpStatus.FORBIDDEN,
    messageKey: 'errors.accountSuspended',
    fallbackMessage: 'The account is suspended',
  },
  SESSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    messageKey: 'errors.sessionNotFound',
    fallbackMessage: 'The requested session was not found',
  },
  UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.unauthorized',
    fallbackMessage: 'Authentication is required',
  },
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    messageKey: 'errors.forbidden',
    fallbackMessage: 'You are not allowed to perform this action',
  },
  TOO_MANY_REQUESTS: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    messageKey: 'errors.tooManyRequests',
    fallbackMessage: 'Too many requests',
  },
  SERVICE_NOT_READY: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    messageKey: 'errors.serviceNotReady',
    fallbackMessage: 'One or more required services are unavailable',
  },
  INTERNAL_SERVER_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    messageKey: 'errors.internalServerError',
    fallbackMessage: 'An unexpected error occurred',
  },
} as const;

export type ErrorCode = keyof typeof ERROR_DEFINITIONS;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_DEFINITIONS, value);
}
