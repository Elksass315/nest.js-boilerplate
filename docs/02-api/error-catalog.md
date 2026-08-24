# Platform Error Catalog

| Status | Code                                        | English message                                                     | Condition                                                                 |
| ------ | ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 400    | `BAD_REQUEST`                               | `The request could not be processed`                                | Malformed JSON, syntax, path, or query encoding.                          |
| 401    | `UNAUTHORIZED`                              | `Authentication is required`                                        | Authentication is absent or invalid.                                      |
| 401    | `INVALID_CREDENTIALS`                       | `Email or password is incorrect`                                    | Credential verification fails without revealing the field.                |
| 401    | `ACCOUNT_LOCKED`                            | `The account is temporarily locked`                                 | Repeated failures activate the configured login lock.                     |
| 401    | `INVALID_OR_EXPIRED_TOKEN`                  | `The token is invalid or has expired`                               | A verification/reset token cannot be consumed.                            |
| 401    | `INVALID_INVITATION_TOKEN`                  | `The invitation token is invalid`                                   | An acceptance token is unknown or has been rotated.                       |
| 401    | `INVALID_REFRESH_TOKEN`                     | `The refresh token is invalid or expired`                           | Refresh state is unknown, expired, revoked, or stale.                     |
| 401    | `REFRESH_TOKEN_REUSED`                      | `Refresh token reuse was detected and the session was revoked`      | A rotated token was presented again.                                      |
| 401    | `INVALID_TWO_STEP_CHALLENGE`                | `The two-step challenge is invalid or has expired`                  | A challenge is unknown, expired, consumed, wrong-purpose, or wrong-owner. |
| 401    | `INVALID_TWO_STEP_CODE`                     | `The two-step verification code is incorrect`                       | An emailed confirmation code does not match.                              |
| 401    | `INVALID_RECOVERY_CODE`                     | `The recovery code is invalid or has already been used`             | A recovery code is unknown or consumed.                                   |
| 401    | `TWO_STEP_ATTEMPTS_EXCEEDED`                | `Too many two-step verification attempts`                           | A challenge reaches its bounded attempt count.                            |
| 403    | `FORBIDDEN`                                 | `You are not allowed to perform this action`                        | The authenticated principal lacks permission.                             |
| 403    | `EMAIL_NOT_VERIFIED`                        | `Verify the email address before signing in`                        | Valid credentials belong to an unverified account.                        |
| 403    | `ACCOUNT_SUSPENDED`                         | `The account is suspended`                                          | Account policy prohibits authentication.                                  |
| 403    | `ROLE_ASSIGNMENT_FORBIDDEN`                 | `You cannot assign the requested role`                              | An inviter attempts to grant a role above their authority.                |
| 404    | `RESOURCE_NOT_FOUND`                        | `The requested resource was not found`                              | No route or requested resource exists.                                    |
| 404    | `USER_NOT_FOUND`                            | `The requested user was not found`                                  | A referenced user identifier does not exist.                              |
| 404    | `ROLE_NOT_FOUND`                            | `One or more requested roles were not found`                        | A required or requested fixed role does not exist.                        |
| 404    | `SESSION_NOT_FOUND`                         | `The requested session was not found`                               | The session is absent or not owned by the caller.                         |
| 404    | `FILE_NOT_FOUND`                            | `The requested file was not found`                                  | A file is missing or unavailable for the requested operation.             |
| 404    | `INVITATION_NOT_FOUND`                      | `The requested invitation was not found`                            | An invitation identifier does not exist.                                  |
| 404    | `FEATURE_FLAG_NOT_FOUND`                    | `The requested feature flag was not found`                          | A feature-flag key is not registered.                                     |
| 403    | `FILE_OWNERSHIP_MISMATCH`                   | `The file does not belong to the authenticated user`                | A stateful upload request targets another user's file.                    |
| 409    | `FILE_OFFSET_MISMATCH`                      | `The upload offset does not match the stored offset`                | A tus PATCH offset differs from the stored upload offset.                 |
| 412    | `TUS_VERSION_UNSUPPORTED`                   | `The tus protocol version is not supported`                         | The client sends an unsupported tus protocol version.                     |
| 410    | `FILE_UPLOAD_EXPIRED`                       | `The file upload has expired`                                       | A resumable upload exceeded its server expiry.                            |
| 410    | `INVITATION_EXPIRED`                        | `The invitation has expired`                                        | A pending invitation exceeded its configured lifetime.                    |
| 409    | `RESOURCE_CONFLICT`                         | `The request conflicts with the current resource state`             | A state, uniqueness, foreign-key, or check conflict occurs.               |
| 409    | `FILE_NOT_READY`                            | `The file is not ready to use`                                      | A business feature tries to claim an incomplete file.                     |
| 409    | `EMAIL_ALREADY_REGISTERED`                  | `An account with this email already exists`                         | Registration races or duplicates the normalized email.                    |
| 409    | `LAST_SUPER_ADMIN`                          | `At least one active super administrator must remain`               | A role/status change would remove the final active owner.                 |
| 409    | `TWO_STEP_ALREADY_ENABLED`                  | `Email two-step verification is already enabled`                    | Enrollment is requested for an enabled account.                           |
| 409    | `TWO_STEP_NOT_ENABLED`                      | `Email two-step verification is not enabled`                        | Disable/regeneration is requested without enrollment.                     |
| 409    | `MEMBER_ALREADY_EXISTS`                     | `A member with this email already exists`                           | An invitation targets an existing account.                                |
| 409    | `INVITATION_ALREADY_PENDING`                | `A pending invitation already exists for this email`                | An unexpired pending invitation targets the normalized email.             |
| 409    | `INVITATION_NOT_PENDING`                    | `The invitation is no longer pending`                               | Resend or revoke targets a terminal invitation.                           |
| 409    | `INVITATION_RESEND_TOO_SOON`                | `Wait before resending this invitation`                             | Resend is requested inside the configured cooldown.                       |
| 409    | `INVITATION_RESEND_LIMIT_REACHED`           | `The invitation resend limit has been reached`                      | Invitation delivery reached the configured send count.                    |
| 409    | `FEATURE_FLAG_ALREADY_EXISTS`               | `A feature flag with this key already exists`                       | Creation uses an already registered stable key.                           |
| 409    | `FEATURE_FLAG_VERSION_CONFLICT`             | `The feature flag changed; read it again before retrying`           | An update supplies a stale optimistic version.                            |
| 409    | `NOTIFICATION_PREFERENCES_VERSION_CONFLICT` | `Notification preferences changed; read them again before retrying` | A preference update supplies a stale version or races initial creation.   |
| 422    | `VALIDATION_ERROR`                          | `Input validation failed`                                           | A well-formed DTO fails validation.                                       |
| 413    | `FILE_TOO_LARGE`                            | `The file exceeds the allowed size`                                 | Upload length exceeds the fixed purpose policy.                           |
| 415    | `FILE_TYPE_NOT_ALLOWED`                     | `The file type is not allowed`                                      | Declared or detected media type violates the purpose policy.              |
| 422    | `FILE_INVALID_IMAGE`                        | `The uploaded image is invalid`                                     | Image decoding, dimensions, animation, or pixel limits fail.              |
| 429    | `TOO_MANY_REQUESTS`                         | `Too many requests`                                                 | Rate-limit policy rejects the request.                                    |
| 503    | `SERVICE_NOT_READY`                         | `One or more required services are unavailable`                     | PostgreSQL, Redis, or enabled storage readiness fails.                    |
| 503    | `FILE_STORAGE_UNAVAILABLE`                  | `File storage is temporarily unavailable`                           | An enabled file provider cannot complete the operation.                   |
| 503    | `INVITATION_DELIVERY_UNAVAILABLE`           | `The invitation email could not be queued`                          | Invitation state persisted but mail enqueue failed.                       |
| 500    | `INTERNAL_SERVER_ERROR`                     | `An unexpected error occurred`                                      | An unhandled or unknown persistence failure reaches the API.              |

Swagger basic-auth failures occur before the Nest pipeline and return their own documented
`SWAGGER_AUTH_REQUIRED` payload. All API errors contain `requestId` and `correlationId`; clients
should report both when requesting support. Field-level validation messages live under
`details.fields`, never in the stable top-level message. Feature-specific errors are registered,
translated, documented, exemplified in Swagger, and tested before merge. Renaming a published code
or changing its meaning is a breaking API change.

**Navigation:** [Previous: OpenAPI and Swagger Standard](openapi-standard.md) | [Documentation Index](../README.md) | [Next: Pagination Standard](pagination-standard.md)
