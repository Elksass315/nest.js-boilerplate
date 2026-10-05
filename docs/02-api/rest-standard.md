# REST and Versioning Standard

- Use plural resource nouns and kebab-case paths; avoid verbs unless modeling a non-CRUD action.
- Business controllers declare `@Controller({ path, version: API_VERSION })` explicitly.
- Business URLs use `/api/v1/<resource>`. API versions are source-controlled, not selected by env.
- Operational controllers declare `VERSION_NEUTRAL` and are explicitly excluded from `/api`.
- Validate path, query, header, and body input at the DTO boundary; reject unknown fields.
- Whitelist filters and sort fields. Bound pagination and expensive operations.
- Never return TypeORM entities as API contracts.
- Never return raw arrays from business collection routes. Offset page/limit is the default; cursor
  pagination requires documented evidence and stable ordering.
- Return and propagate both `x-request-id` and `x-correlation-id`.

## Success response envelope

Every JSON success response with a body is returned in the same envelope:

```json
{
  "success": true,
  "meta": {
    "requestId": "2b8c5cc6-8be2-4be8-86e8-dbf7e866130e",
    "correlationId": "2b8c5cc6-8be2-4be8-86e8-dbf7e866130e",
    "timestamp": "2026-02-24T10:41:22.500Z"
  },
  "data": {}
}
```

`data` contains the endpoint's normal response, including paginated `items` and pagination
metadata. Existing error responses are unchanged. Binary downloads, tus protocol responses, and
`204 No Content` responses are transport-specific exceptions and are not wrapped.

Backward-incompatible behavior requires a version strategy, migration guidance, tests,
documentation, and release communication. A controller without explicit version metadata fails
`pnpm arch:check`.

**Navigation:** [Previous: Users Module](../01-backend/modules/users.md) | [Documentation Index](../README.md) | [Next: OpenAPI and Swagger Standard](openapi-standard.md)
