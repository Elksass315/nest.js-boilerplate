# Users Module

## Purpose and scope

`users` owns account identity state, profile data, role assignments, and append-only security audit
records. It does not authenticate credentials, issue tokens, manage sessions, send mail, or define
role/permission policy. Those capabilities belong to the `auth`, `mail`, and `authorization`
modules.

## Structure and public surface

The module follows `controller -> service -> concrete repository -> TypeORM`. It exports
`UsersService` plus the intentional `CreatePendingUserInput`, `UserWithRoles`, and `UserStatus`
contracts for the auth module. Entities, the repository, HTTP DTOs, and password hashes remain
private. The module imports only the public `authorization` index and resolves opaque role IDs through
`AuthorizationService`; it never queries authorization tables.

## API contracts

All routes use URI version `v1` and require the `PermissionsGuard`. The global access-token guard
hydrates the typed `request.user` principal from current user/session state before permission checks.

| Method | Route               | Policy                | Success | Reachable errors                                                 |
| ------ | ------------------- | --------------------- | ------- | ---------------------------------------------------------------- |
| GET    | `/users/me`         | authenticated         | 200     | 401                                                              |
| PATCH  | `/users/me`         | authenticated         | 200     | 401, 422 `VALIDATION_ERROR`                                      |
| GET    | `/users`            | `users.read`          | 200     | 401, 403, 422 `VALIDATION_ERROR`                                 |
| GET    | `/users/:id`        | `users.read`          | 200     | 400 `BAD_REQUEST`, 401, 403, 404 `USER_NOT_FOUND`                |
| PATCH  | `/users/:id/status` | `users.status.manage` | 200     | 400, 401, 403, 404 `USER_NOT_FOUND`, 409 `LAST_SUPER_ADMIN`, 422 |
| PUT    | `/users/:id/roles`  | `users.roles.manage`  | 200     | 400, 401, 403, 404 user/role, 409 `LAST_SUPER_ADMIN`, 422        |

Collections use canonical page/limit offset pagination. Responses never contain `passwordHash`,
normalized email, login counters, lock timestamps, or ORM entities. Swagger contains concrete
payloads and exact stable error messages for every route.

## Data and migrations

`users` contains required full name, original and normalized email, Argon2id-ready password hash,
status, email verification time, email two-step flag, `authVersion`, failed-login count, and lock
expiration. The database enforces unique normalized email, allowed statuses, positive auth version,
and non-negative failure count.

`user_roles` stores UUID assignments with a unique `(user_id, role_id)` pair. Role IDs are opaque to
this module; foreign keys preserve referential integrity without cross-module entity imports.
`user_security_audits` stores actor, subject, event, safe metadata, request ID, and correlation ID.
Updates run in service-owned transactions. Status/role mutations increment `authVersion` so later
token validation can invalidate stale authorization state.

Status and role mutations enqueue correlated security emails after persistence succeeds. Payloads
contain only the target user's public display data and the safe resulting state; audit records and
logs never contain message bodies or full mail-job payloads.

The last-active-super-admin rule is serialized with PostgreSQL transaction advisory lock
`users:last-super-admin`, preventing concurrent status or role changes from removing all active
super administrators.

## Security and observability

Emails and password hashes never appear in logs or audit metadata. Audit events contain only safe
state transitions and role keys. Every audit copies `x-request-id` and `x-correlation-id` from the
request context. Role/status changes record the authenticated actor and reject missing or inadequate
principals through stable `UNAUTHORIZED` and `FORBIDDEN` errors.

## Test strategy and change impact

Unit tests cover paginated response mapping, credential-field exclusion, duplicate emails,
correlated auth/profile audit data, lockout transitions, password auth-version changes, role
replacement, and last-super-admin protection. Migration validation exercises `up` and `down`
against a temporary PostgreSQL test database.

## Cursor pagination rationale

Not applicable. User administration uses bounded offset pagination; no measured scale or stable
append traversal requirement justifies cursor pagination.
