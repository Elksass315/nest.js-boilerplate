# Error Handling

Core owns the stable error registry, `AppException`, validation mapping, and global filter. Every
definition provides an HTTP status, English translation key, and safe fallback. Feature changes add
the code, English resource, error catalog, Swagger examples, tests, and module documentation together.

Malformed syntax returns `400`; a well-formed request that fails DTO rules returns
`422 VALIDATION_ERROR` with messages under `details.fields`. Unknown failures return a safe 500 and
log internal diagnostics without exposing them.

```json
{
  "statusCode": 422,
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "timestamp": "2026-08-12T12:00:00.000Z",
  "path": "/api/v1/resources",
  "requestId": "01J5EXAMPLE0000000000000000",
  "correlationId": "01J5EXAMPLE0000000000000001",
  "details": { "fields": { "name": ["name should not be empty"] } }
}
```

Identity foundation errors distinguish missing users/roles, normalized-email conflicts, and the
last-active-super-admin invariant. They use `USER_NOT_FOUND`, `ROLE_NOT_FOUND`,
`EMAIL_ALREADY_REGISTERED`, and `LAST_SUPER_ADMIN`; repositories never leak PostgreSQL constraint
names or credential/account internals.

Authentication errors are condition-specific without leaking secrets or distinguishing unknown
recovery emails. Invalid credentials and action/refresh tokens use 401; verified-account policy
failures use 403; session ownership failures use 404. `REFRESH_TOKEN_REUSED` also signals that the
affected session was revoked. Exact English fallbacks remain aligned across the registry, Swagger,
translations, and error catalog.

Email two-step failures use stable, non-secret-bearing codes. Invalid, expired, consumed,
wrong-purpose, or wrong-owner challenges return `INVALID_TWO_STEP_CHALLENGE`. Incorrect email and
recovery proofs return `INVALID_TWO_STEP_CODE` and `INVALID_RECOVERY_CODE`; the latter does not
reveal whether a recovery code ever existed. A challenge reaching its configured attempt bound
returns `TWO_STEP_ATTEMPTS_EXCEEDED`. Enrollment-state conflicts use
`TWO_STEP_ALREADY_ENABLED` and `TWO_STEP_NOT_ENABLED`. Controllers document every reachable code
with the exact registered English message.

File storage errors distinguish hidden/missing public files, expired uploads, incomplete claims,
size/type/image-policy failures, and provider outages without leaking a storage key, local path,
bucket, filename, or provider response. tus transport failures use protocol-compatible HTTP
statuses while retaining stable codes such as `FILE_NOT_FOUND`, `FILE_UPLOAD_EXPIRED`,
`FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, and `FILE_STORAGE_UNAVAILABLE`.

**Navigation:** [Previous: Database, Migration, and Seed Standard](database.md) | [Documentation Index](../README.md) | [Next: Health Endpoints](health.md)
