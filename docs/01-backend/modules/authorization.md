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

| Role          | Permissions                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `super_admin` | User/session administration, cross-user security-audit lookup, plus all four `team.invitations.*` permissions      |
| `admin`       | `users.read` plus all invitation permissions; service policy limits this role to inviting ordinary `user` accounts |
| `user`        | none; authenticated self-service only                                                                              |

Definitions are seeded and immutable through the API. `RequireAuthenticated` checks for a principal;
`RequirePermissions` additionally requires every declared permission. Missing principals produce
`401 UNAUTHORIZED`; inadequate permissions produce `403 FORBIDDEN`. Both decorators also attach
the named Swagger bearer security requirement, so protected operations display the authorization
lock while public operations remain unlocked.

## API contracts

`GET /api/v1/authorization/roles?page=1&limit=20` requires `users.read` and returns the canonical
offset page of role IDs, keys, names, descriptions, and effective permission keys. Reachable failures
are `401 UNAUTHORIZED`, `403 FORBIDDEN`, and `422 VALIDATION_ERROR`; Swagger documents exact payloads.

## Data, migration, and seed

`authorization_roles`, `authorization_permissions`, and `authorization_role_permissions` use UUID
base entities, unique stable keys, unique role-permission pairs, and cascading internal foreign keys.
Seed `002-rbac` installs the base deterministic IDs. Immutable seed `003-team-invitations-rbac`
adds invitation permissions without changing the checksum of the applied base seed. Applied seed
content must never be edited; policy changes require a new ordered seed. Immutable seed
`004-security-audit-rbac` adds `users.security-audits.read.any` only to `super_admin`; administrators
retain read-only user lookup but cannot inspect another user's security history.
Immutable seed `005-feature-flags-rbac` grants `feature-flags.read` to administrators and super
administrators, while `feature-flags.manage` remains restricted to super administrators.

## Security and observability

The authenticated principal is populated by the auth access-token guard and contains current user
ID, optional session ID, auth version, role keys, and resolved permissions. The session ID is present
for token-authenticated requests and allows logout/session workflows without exposing persistence
entities. Authorization continues to trust only the current principal produced from live user and
session state.

Authorization errors use the global localized error contract and retain request/correlation IDs. No
credentials or personal data enter RBAC logs.

Per-user permission overrides are resolved live as role permissions plus explicit grants minus
explicit revokes. Collection and authentication resolution load all overrides and permission keys
in bounded batch queries. The override management permission is seeded only for `super_admin`, and
mutation independently verifies that the live principal has a real `super_admin` role. Explicit
grants cannot delegate `users.permissions.manage` or `users.roles.manage`.

## Test strategy and change impact

Unit tests cover pagination, batched effective permissions, missing roles, incomplete role sets,
successful authorization, absent authentication, and inadequate permissions. Service and E2E tests
prove that a delegated management permission cannot mutate overrides. Migration/seed validation
confirms constraints and immutable reference data in PostgreSQL.

## Cursor pagination rationale

Not applicable. The fixed role set is small and uses offset pagination to preserve one collection
contract across business APIs.

Users inherit role permissions by default. Super administrators may manage per-user grant and revoke
overrides; effective permissions are resolved live as role permissions plus grants minus revokes.

**Navigation:** [Previous: Auth and Sessions Module](auth.md) | [Documentation Index](../../README.md) | [Next: Files Module](files.md)
