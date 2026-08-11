# Feature Completion Checklist

Use only the sections that match the requested capability.

## Structure

- Feature has one owning Nest module and a public `index.ts`.
- Controller exists only for HTTP; repository/entity exist only for persistence.
- No DDD layers, speculative adapters, generic utilities, or cross-feature internals.

## Contracts and behavior

- Controller declares `version: API_VERSION`; operational endpoints alone use `VERSION_NEUTRAL`.
- External input uses validated DTOs with Swagger metadata.
- Responses use explicit DTOs and do not serialize entities directly.
- Service owns rules and transactions; repository owns queries and locking.
- Errors use stable codes and safe client messages.
- Logs include correlation context without secrets or personal data.

## OpenAPI contract

- Every route has an `@ApiOperation` summary and behavior description.
- Every reachable success and failure HTTP status has its own response decorator.
- Every response decorator explains when the response occurs and includes a realistic payload
  example; errors show the exact `code` and client-visible `message`.
- Every request field has an example. Distinct accepted request bodies are named separately with
  `@ApiBody({ content: { 'application/json': { examples: ... } } })`.
- Examples contain no real credentials, tokens, personal data, or unstable generated values.
- Swagger metadata, DTO validation, controller behavior, tests, and module docs describe the same
  contract.

## Persistence

- Schema change has an explicit migration with safe up/down or documented forward-fix policy.
- Synchronization remains disabled.
- Constraints and indexes enforce real invariants where appropriate.
- Query and transaction failure paths are covered.

## Verification

- Unit tests cover success, validation, conflicts, not-found, and dependency failures as relevant.
- E2E tests cover the public contract when one exists.
- Documentation changes accompany contract, security, architecture, or operational changes.
- `pnpm arch:check`, `pnpm docs:check`, `pnpm typecheck`, focused tests, and `pnpm validate` pass.
