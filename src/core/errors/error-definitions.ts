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
  INVITATION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    messageKey: 'errors.invitationNotFound',
    fallbackMessage: 'The requested invitation was not found',
  },
  INVALID_INVITATION_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.invalidInvitationToken',
    fallbackMessage: 'The invitation token is invalid',
  },
  INVITATION_EXPIRED: {
    status: HttpStatus.GONE,
    messageKey: 'errors.invitationExpired',
    fallbackMessage: 'The invitation has expired',
  },
  INVITATION_ALREADY_PENDING: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.invitationAlreadyPending',
    fallbackMessage: 'A pending invitation already exists for this email',
  },
  INVITATION_NOT_PENDING: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.invitationNotPending',
    fallbackMessage: 'The invitation is no longer pending',
  },
  INVITATION_RESEND_TOO_SOON: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.invitationResendTooSoon',
    fallbackMessage: 'Wait before resending this invitation',
  },
  INVITATION_RESEND_LIMIT_REACHED: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.invitationResendLimitReached',
    fallbackMessage: 'The invitation resend limit has been reached',
  },
  INVITATION_DELIVERY_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    messageKey: 'errors.invitationDeliveryUnavailable',
    fallbackMessage: 'The invitation email could not be queued',
  },
  MEMBER_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.memberAlreadyExists',
    fallbackMessage: 'A member with this email already exists',
  },
  FEATURE_FLAG_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    messageKey: 'errors.featureFlagNotFound',
    fallbackMessage: 'The requested feature flag was not found',
  },
  FEATURE_FLAG_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.featureFlagAlreadyExists',
    fallbackMessage: 'A feature flag with this key already exists',
  },
  FEATURE_FLAG_VERSION_CONFLICT: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.featureFlagVersionConflict',
    fallbackMessage: 'The feature flag changed; read it again before retrying',
  },
  ROLE_ASSIGNMENT_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    messageKey: 'errors.roleAssignmentForbidden',
    fallbackMessage: 'You are not allowed to assign the requested role',
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
  INVALID_OR_EXPIRED_VERIFICATION_CODE: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.invalidOrExpiredVerificationCode',
    fallbackMessage: 'The verification code is invalid or has expired',
  },
  VERIFICATION_ATTEMPTS_EXCEEDED: {
    status: HttpStatus.UNAUTHORIZED,
    messageKey: 'errors.verificationAttemptsExceeded',
    fallbackMessage: 'Too many email verification attempts; request a new code',
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
  FILE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    messageKey: 'errors.fileNotFound',
    fallbackMessage: 'The requested file was not found',
  },
  FILE_OWNERSHIP_MISMATCH: {
    status: HttpStatus.FORBIDDEN,
    messageKey: 'errors.fileOwnershipMismatch',
    fallbackMessage: 'The file does not belong to the authenticated user',
  },
  FILE_OFFSET_MISMATCH: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.fileOffsetMismatch',
    fallbackMessage: 'The upload offset does not match the stored offset',
  },
  TUS_VERSION_UNSUPPORTED: {
    status: HttpStatus.PRECONDITION_FAILED,
    messageKey: 'errors.tusVersionUnsupported',
    fallbackMessage: 'The tus protocol version is not supported',
  },
  FILE_UPLOAD_EXPIRED: {
    status: HttpStatus.GONE,
    messageKey: 'errors.fileUploadExpired',
    fallbackMessage: 'The file upload has expired',
  },
  FILE_NOT_READY: {
    status: HttpStatus.CONFLICT,
    messageKey: 'errors.fileNotReady',
    fallbackMessage: 'The file is not ready to use',
  },
  FILE_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    messageKey: 'errors.fileTooLarge',
    fallbackMessage: 'The file exceeds the allowed size',
  },
  FILE_TYPE_NOT_ALLOWED: {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    messageKey: 'errors.fileTypeNotAllowed',
    fallbackMessage: 'The file type is not allowed',
  },
  FILE_INVALID_IMAGE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    messageKey: 'errors.fileInvalidImage',
    fallbackMessage: 'The uploaded image is invalid',
  },
  FILE_STORAGE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    messageKey: 'errors.fileStorageUnavailable',
    fallbackMessage: 'File storage is temporarily unavailable',
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
    fallbackMessage: 'Internal server error',
  },
} as const;

export type ErrorCode = keyof typeof ERROR_DEFINITIONS;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_DEFINITIONS, value);
}
