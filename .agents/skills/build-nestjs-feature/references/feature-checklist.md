# Feature Completion Checklist

Use only the sections that match the requested capability.

## Structure

- Feature has one owning Nest module and a public `index.ts`.
- Controller exists only for HTTP; repository/entity exist only for persistence.
- No DDD layers, speculative adapters, generic utilities, or cross-feature internals.
- Normal entities extend `AppBaseEntity`; soft deletion has a current documented requirement.

## Contracts and behavior

- Controller declares `version: API_VERSION`; operational endpoints alone use `VERSION_NEUTRAL`.
- External input uses validated DTOs with Swagger metadata.
- Responses use explicit DTOs and do not serialize entities directly.
- Service owns rules and transactions; repository owns queries and locking.
- Errors use registered stable codes, safe messages, and complete English translations.
- Validation failures use structured `422 VALIDATION_ERROR` field details.
- Logs and work items preserve request/correlation IDs without secrets or personal data.

## Collections

- Every collection route uses the canonical offset page unless cursor pagination is justified.
- Raw array responses are forbidden.
- Offset responses include `items` and complete page metadata.
- Cursor ordering is stable, has a unique tie-breaker, and its rationale is in module docs.
- Matching pagination DTOs and Swagger decorators describe the implemented contract.

## OpenAPI contract

- Every route has an `@ApiOperation` summary and behavior description.
- Every reachable success and failure status has its own response decorator.
- Every response explains when it occurs and has a realistic payload example.
- Errors show the exact `code` and client-visible `message`.
- Every request field has an example; distinct bodies have named `@ApiBody` examples.
- Swagger, DTO validation, behavior, tests, translations, and module docs agree.

## Persistence

- Schema changes have explicit migrations with safe reversal or documented forward-fix policy.
- Reference-data changes use immutable ordered seeds when appropriate.
- Synchronization remains disabled; constraints and indexes enforce real invariants.
- Query, transaction, migration, and seed failure paths are covered.

## File consumers

- Upload routes are owned by the consuming feature; there is no generic upload endpoint.
- POST, HEAD, PATCH, and DELETE tus requests require authentication and ownership checks.
- The feature calls only the public `FilesService` and supplies a fixed purpose, maximum size, and
  declared MIME allowlist. Storage keys remain server-generated and visibility starts protected.
- Processing, cleanup, migration, audit, Swagger, configuration, Compose, and correlation behavior
  are updated together when applicable.
- Image publication validates MIME/extension/detected format, bytes, dimensions, pixels, animation,
  and decoding; sanitized bytes use a new server-generated immutable key and contain no metadata.

## Verification

- Tests cover success and relevant validation, conflict, not-found, authorization, and dependency failures.
- E2E tests cover public contracts.
- Documentation changes accompany contract, security, architecture, and operational changes.
- `pnpm validate:change` passes after the coding prompt; all mandatory baseline, selected, and
  documentation-companion gates pass without bypassing failures.
- Full `pnpm validate` passes before PR/release handoff or when the change is broad or high risk.
- Relevant e2e, migration, seed, worker, SMTP, and Docker checks pass when those surfaces changed.
