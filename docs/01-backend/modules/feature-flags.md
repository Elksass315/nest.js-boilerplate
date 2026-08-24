# Feature flags module

## Purpose and scope

The module owns global, runtime boolean switches for reusable deployments. It intentionally does not
implement user targeting, percentage rollout, scheduled activation, experiments, or environment
overrides. Those policies require project-specific evidence and a separate design review.

Other modules evaluate a registered flag through the exported `FeatureFlagsService.isEnabled(key)`
method. Unknown keys fail explicitly instead of silently enabling or disabling behavior.

## API contracts

All routes are versioned under `/api/v1/feature-flags`, authenticated, and protected by RBAC.
Administrators and super administrators may list and read flags; only super administrators may
create or change them. Collection responses use canonical page/limit pagination.

- `GET /api/v1/feature-flags?page=1&limit=20`
- `GET /api/v1/feature-flags/:key`
- `POST /api/v1/feature-flags`
- `PATCH /api/v1/feature-flags/:key`

Updates include `expectedVersion`; stale concurrent changes fail with
`FEATURE_FLAG_VERSION_CONFLICT`. Stable module errors are `FEATURE_FLAG_NOT_FOUND`,
`FEATURE_FLAG_ALREADY_EXISTS`, and `FEATURE_FLAG_VERSION_CONFLICT`.

## Data, security, and observability

`feature_flags` stores the immutable key, operator description, boolean state, version, and last
actor. `feature_flag_audits` is append-only and records every effective creation/change with actor,
request ID, correlation ID, old state, and new state in the same database transaction. No endpoint
deletes flags, preventing an operator action from silently changing unknown-key behavior.

Migration `1787270400000-CreateFeatureFlags` owns both tables and their constraints. Seed
`005-feature-flags-rbac` adds read and manage permissions but creates no flags, keeping the template
free of project-specific behavior.

## Verification and rollback

Unit tests cover evaluation, pagination, creation auditing, duplicate keys, stale updates, and
idempotent updates. Migration and seed validation cover schema creation/reversion and immutable RBAC
data. Rollback removes the audit table before the flag table; application code using a flag must be
removed or disabled before reverting the migration.
