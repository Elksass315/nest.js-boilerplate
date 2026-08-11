# Shared Foundation Standard

Reusable code has one clear home:

- `src/core` owns mandatory application policies such as errors, request context, and i18n wiring.
- `src/common` owns reusable NestJS/HTTP contracts, decorators, Swagger helpers, and pagination.
- `src/shared` owns small framework-light primitives with proven reuse, including entity bases.
- `src/types` owns ambient declarations and compile-time-only contracts.

Feature behavior stays inside its owning module. Never create generic `utils.ts`, `helpers.ts`, or
shared business services. A normal entity extends `AppBaseEntity`; `SoftDeleteEntity` is allowed only
with documented restore/retention behavior and matching repository tests.

The entity bases map UUID `id` plus `created_at`, `updated_at`, and opt-in `deleted_at` PostgreSQL
columns explicitly; migrations use those same snake_case names rather than relying on an implicit
naming strategy.

Every request has a unique `x-request-id`. Related work shares `x-correlation-id`; accept only the
validated inbound format, otherwise generate one. Return both headers, include both IDs in errors,
and propagate correlation into jobs, audits, and outbound calls.
