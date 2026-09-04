# OpenAPI and Swagger Standard

Swagger is an executable API contract, not a route inventory.

JSON success responses use the standard `{ success, meta, data }` envelope. The `meta` object
contains the request ID, correlation ID, and response timestamp; the endpoint payload is under
`data`. Error responses retain the existing stable error contract. Binary and protocol-specific
responses, plus `204 No Content`, are documented as their native transport responses.

CI generates the complete document with `pnpm openapi:generate` and validates the generated
`.tmp/openapi.json` with `pnpm openapi:check`. The linter checks operation metadata, request and
success examples, and every 4xx/5xx example against the stable error catalog embedded in the
document. The generated file is a build artifact and is not committed.

## Every route

- Add `@ApiOperation` with a concise summary and a behavioral description.
- Document every reachable success and error HTTP status with its own response decorator.
- Give every response a condition-specific description and concrete `application/json` payload.
- Error examples include the exact `statusCode`, stable `code`, client-visible `message`, `path`,
  `requestId`, and relevant safe details produced by the implementation.
- Keep decorators aligned with DTO validation, service behavior, tests, and module documentation.
- Every route explicitly declares `Public`, `RequireAuthenticated`, or `RequirePermissions`.
  Protected decorators install the runtime permission guard and provide Swagger bearer metadata;
  the API contract checker rejects routes whose access policy is implicit.

## Request examples

Every external DTO property has validation and a realistic Swagger example. If one endpoint accepts
multiple meaningful body shapes, add named media-type examples:

```ts
@ApiBody({
  content: {
    'application/json': {
      examples: {
        cardPayment: { summary: 'Card payment', value: { method: 'card', token: 'tok_example' } },
        bankTransfer: {
          summary: 'Bank transfer',
          value: { method: 'bank_transfer', reference: 'INV-1001' },
        },
      },
    },
  },
})
```

Examples must be deterministic and synthetic. Never include real credentials, tokens, customer
data, internal hosts, or values that contradict validation.

## Access policy

`SWAGGER_DOCS_ACCESS=public` exposes `/docs`, `/docs-json`, and `/docs-yaml` in development/test.
`basic` protects all three endpoints with HTTP Basic authentication. `disabled` registers none of
them. Staging and production reject `public`; production should normally use `disabled`.

`pnpm arch:check` rejects unversioned controllers, missing operation descriptions, missing response
decorators, and response documentation without concrete content examples. Semantic completeness—
all reachable statuses and all accepted body variants—remains a mandatory review check.

The canonical `ApiOffsetPaginatedResponse` and `ApiCursorPaginatedResponse` decorators are composed
response contracts: the static checker recognizes their embedded description and schema content.
Pass a deterministic page example to `ApiOffsetPaginatedResponse` for feature collections so the
generated contract shows both the item DTO and real page metadata without duplicating the schema.
All other response decorators declare `description` and concrete `content` directly at the route.

Stable error payloads should use the shared `swaggerErrorContent` helper. It derives the HTTP status,
stable code, and client-visible fallback message from `ERROR_DEFINITIONS`, while callers provide only
the route and any safe validation details. This prevents controllers from drifting from the error
catalog.

**Navigation:** [Previous: REST and Versioning Standard](rest-standard.md) | [Documentation Index](../README.md) | [Next: Platform Error Catalog](error-catalog.md)
