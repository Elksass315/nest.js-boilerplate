# Error Handling

All controller failures use the global error envelope:

```json
{
  "statusCode": 409,
  "code": "RESOURCE_CONFLICT",
  "message": "A resource with this identifier already exists",
  "timestamp": "2026-08-11T12:00:00.000Z",
  "path": "/api/v1/resources",
  "requestId": "01J5EXAMPLE0000000000000000",
  "details": {}
}
```

Codes are stable machine contracts; messages are safe client-facing explanations. Never expose SQL
errors, stack traces, credentials, internal hosts, or dependency implementation details. Each new
failure code must be added to the error catalog, Swagger response example, tests, and owning module
documentation in the same change.

Swagger descriptions state when the failure occurs. An annotation such as "Bad request" is not
enough: document the actual condition, exact code, and exact message emitted by the implementation.
