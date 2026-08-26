# Users Module

## Purpose and scope

`users` owns account identity state, profile data, role assignments, and append-only security audit
records. It does not authenticate credentials, issue tokens, manage sessions, send mail, or define
role/permission policy. Those capabilities belong to the `auth`, `mail`, and `authorization`
modules.
It owns avatar authorization, upload routes, image policy, profile attachment, and avatar security
audits while consuming byte storage only through the public `FilesService`.

## Structure and public surface

The module follows `controller -> service -> concrete repository -> TypeORM`. It exports
`UsersService` plus the intentional `CreatePendingUserInput`, `UserWithRoles`, and `UserStatus`
contracts for the auth module. Entities, the repository, HTTP DTOs, and password hashes remain
private. The module imports only the public `authorization` index and resolves opaque role IDs through
`AuthorizationService`; it never queries authorization tables.

The public service exposes a narrow normalized-email existence check and correlated security-audit
command for invitations. That feature cannot access user entities or repositories; users remains
the sole owner of account lookup and audit persistence.
The public service also provides a transaction-aware invited-user command that creates an active
verified account, one fixed role assignment, and its acceptance audit atomically.
Pending registration creation/revision is serialized by normalized-email advisory lock. A repeated
pending registration updates only its full name, canonical email, and password hash and records
`auth.registration.updated`; active and suspended duplicates remain conflicts.

## API contracts

All routes use URI version `v1` and require the `PermissionsGuard`. The global access-token guard
hydrates the typed `request.user` principal from current user/session state before permission checks.

| Method                 | Route                                  | Policy                           | Success | Reachable errors                                                 |
| ---------------------- | -------------------------------------- | -------------------------------- | ------- | ---------------------------------------------------------------- |
| GET                    | `/users/me`                            | authenticated                    | 200     | 401                                                              |
| GET                    | `/users/me/security-audits`            | authenticated                    | 200     | 401, 422 `VALIDATION_ERROR`                                      |
| PATCH                  | `/users/me`                            | authenticated                    | 200     | 401, 422 `VALIDATION_ERROR`                                      |
| OPTIONS                | `/users/me/avatar/uploads`             | public capability                | 204     | none                                                             |
| POST/HEAD/PATCH/DELETE | `/users/me/avatar/uploads[/:uploadId]` | authenticated owner              | tus     | 400, 401, 403, 404, 409, 410, 412, 413, 415, 503                 |
| PATCH                  | `/users/me/avatar`                     | authenticated                    | 200     | 401, 403, 404, 409, 410, 413, 415, 422, 503                      |
| DELETE                 | `/users/me/avatar`                     | authenticated                    | 204     | 401, 404                                                         |
| GET                    | `/users`                               | `users.read`                     | 200     | 401, 403, 422 `VALIDATION_ERROR`                                 |
| GET                    | `/users/:id`                           | `users.read`                     | 200     | 400 `BAD_REQUEST`, 401, 403, 404 `USER_NOT_FOUND`                |
| GET                    | `/users/:id/security-audits`           | `users.security-audits.read.any` | 200     | 400, 401, 403, 404 `USER_NOT_FOUND`, 422 `VALIDATION_ERROR`      |
| PATCH                  | `/users/:id/status`                    | `users.status.manage`            | 200     | 400, 401, 403, 404 `USER_NOT_FOUND`, 409 `LAST_SUPER_ADMIN`, 422 |
| PUT                    | `/users/:id/roles`                     | `users.roles.manage`             | 200     | 400, 401, 403, 404 user/role, 409 `LAST_SUPER_ADMIN`, 422        |

Collections use canonical page/limit offset pagination. Responses never contain `passwordHash`,
normalized email, login counters, lock timestamps, or ORM entities. Swagger contains concrete
payloads and exact stable error messages for every route.
User responses include `avatar: null` or an immutable contract with file ID, absolute public URL,
detected MIME type, and sanitized byte size. The URL uses the configured `APP_BASE_URL` origin.

Security-audit collections are ordered by `createdAt DESC, id DESC` and expose event type, actor
identifier, occurrence time, correlation ID, and an event-specific allowlist of safe details. Raw
metadata and request IDs remain private. Personal lookup is always scoped from the authenticated
principal; callers cannot supply a different subject. Cross-user lookup requires the dedicated
super-admin-only `users.security-audits.read.any` permission.

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
Migration `1787184000000-IndexSecurityAuditPagination` replaces the earlier subject/time index with
`(user_id, created_at, id)` so the API's deterministic tie-breaker is indexed and reversible.

Status and role mutations enqueue correlated security emails after persistence succeeds. Payloads
contain only the target user's public display data and the safe resulting state; audit records and
logs never contain message bodies or full mail-job payloads.

The last-active-super-admin rule is serialized with PostgreSQL transaction advisory lock
`users:last-super-admin`, preventing concurrent status or role changes from removing all active
super administrators.

`users.avatar_file_id` is nullable and unique. Avatar attachment locks the user then file row in one
transaction, claims only a completed unexpired `user_avatar` upload owned by that user, and records
`user.avatar.changed`. Repeating the same attachment or removal is idempotent. Replaced files enter
durable `deleting` state inside the transaction; cleanup jobs are sent only after commit.

## Security and observability

Emails and password hashes never appear in logs or audit metadata. Audit events contain only safe
state transitions and role keys. Every audit copies `x-request-id` and `x-correlation-id` from the
request context. Role/status changes record the authenticated actor and reject missing or inadequate
principals through stable `UNAUTHORIZED` and `FORBIDDEN` errors.

Invitation management records `team.invitation.created`, `team.invitation.resent`,
`team.invitation.revoked`, and `team.invitation.accepted` with invitation IDs and safe role metadata
only. Tokens and recipient emails never enter audit metadata.

Avatar sources are limited to JPEG, PNG, and WebP. Declared MIME, filename extension, and decoded
format must agree. Sharp bounds dimensions and decoded pixels, rejects multi-frame images, safely
decodes, applies orientation, and re-encodes in the same format without EXIF or other metadata. Raw
uploads remain protected and never become profile images directly.

## Test strategy and change impact

Unit tests cover paginated response mapping, credential-field exclusion, safe audit-detail
allowlisting, personal scoping, privileged missing-user handling, duplicate emails,
correlated auth/profile audit data, lockout transitions, password auth-version changes, role
replacement, and last-super-admin protection. Migration validation exercises `up` and `down`
against a temporary PostgreSQL test database. Avatar tests cover resumable-route delegation,
ownership, format spoofing, malformed images, dimensions/pixels, animation metadata, metadata
removal, transactional replacement races, idempotency, deletion, and correlation propagation.

## Cursor pagination rationale

Not applicable. User administration uses bounded offset pagination; no measured scale or stable
append traversal requirement justifies cursor pagination.

**Navigation:** [Previous: Mail Module](mail.md) | [Documentation Index](../../README.md) | [Next: REST and Versioning Standard](../../02-api/rest-standard.md)
