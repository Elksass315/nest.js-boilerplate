# Authorization Module

## Purpose and scope

`authorization` owns fixed RBAC role and permission definitions, effective-permission resolution,
the authenticated principal contract, authorization decorators, and `PermissionsGuard`. It does not
authenticate credentials, issue tokens, assign roles to users, or expose role/permission mutation
APIs.

## Structure and public surface

The controller lists roles, the service resolves policy, and the concrete repository exclusively
queries authorization tables. The public index exports the module/service, typed principal,
role/permission contracts, and decorators/guard required by owning feature modules. Entities and the
repository remain private.

## RBAC policy

| Role          | Permissions                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `super_admin` | `users.read`, `users.status.manage`, `users.roles.manage`, `sessions.read.any`, `sessions.revoke.any` |
| `admin`       | `users.read`                                                                                          |
| `user`        | none; authenticated self-service only                                                                 |

Definitions are seeded and immutable through the API. `RequireAuthenticated` checks for a principal;
`RequirePermissions` additionally requires every declared permission. Missing principals produce
`401 UNAUTHORIZED`; inadequate permissions produce `403 FORBIDDEN`.

## API contracts

`GET /api/v1/authorization/roles?page=1&limit=20` requires `users.read` and returns the canonical
offset page of role IDs, keys, names, descriptions, and effective permission keys. Reachable failures
are `401 UNAUTHORIZED`, `403 FORBIDDEN`, and `422 VALIDATION_ERROR`; Swagger documents exact payloads.

## Data, migration, and seed

`authorization_roles`, `authorization_permissions`, and `authorization_role_permissions` use UUID
base entities, unique stable keys, unique role-permission pairs, and cascading internal foreign keys.
Seed `002-rbac` installs deterministic IDs and the policy above through the checksum-protected seed
runner. Applied seed content must never be edited; policy changes require a new ordered seed.

## Security and observability

The authenticated principal is populated by the auth access-token guard and contains current user
ID, optional session ID, auth version, role keys, and resolved permissions. The session ID is present
for token-authenticated requests and allows logout/session workflows without exposing persistence
entities. Authorization continues to trust only the current principal produced from live user and
session state.

Authorization errors use the global localized error contract and retain request/correlation IDs. No
credentials or personal data enter RBAC logs.

## Test strategy and change impact

Unit tests cover pagination, effective permissions, missing roles, incomplete role sets, successful
authorization, absent authentication, and inadequate permissions. Migration/seed validation confirms
constraints and immutable reference data in PostgreSQL.

## Cursor pagination rationale

Not applicable. The fixed role set is small and uses offset pagination to preserve one collection
contract across business APIs.

**Navigation:** [Previous: Auth and Sessions Module](auth.md) | [Documentation Index](../../README.md) | [Next: Files Module](files.md)
