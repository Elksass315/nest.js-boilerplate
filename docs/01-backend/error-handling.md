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
