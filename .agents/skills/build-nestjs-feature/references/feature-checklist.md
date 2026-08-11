# Feature Completion Checklist

Use only the sections that match the requested capability.

## Structure

- Feature has one owning Nest module and a public `index.ts`.
- Controller exists only for HTTP; repository/entity exist only for persistence.
- No DDD layers, speculative adapters, generic utilities, or cross-feature internals.

## Contracts and behavior

- External input uses validated DTOs with Swagger metadata.
- Responses use explicit DTOs and do not serialize entities directly.
- Service owns rules and transactions; repository owns queries and locking.
- Errors use stable codes and safe client messages.
- Logs include correlation context without secrets or personal data.

## Persistence

- Schema change has an explicit migration with safe up/down or documented forward-fix policy.
- Synchronization remains disabled.
- Constraints and indexes enforce real invariants where appropriate.
- Query and transaction failure paths are covered.

## Verification

- Unit tests cover success, validation, conflicts, not-found, and dependency failures as relevant.
- E2E tests cover the public contract when one exists.
- Documentation changes accompany contract, security, architecture, or operational changes.
- `pnpm arch:check`, `pnpm typecheck`, focused tests, and `pnpm validate` pass.
