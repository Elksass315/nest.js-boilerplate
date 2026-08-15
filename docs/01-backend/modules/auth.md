# Auth and Sessions Module

## Purpose and scope

`auth` owns registration orchestration, email-verification and password-reset tokens, credential
checks, temporary lockout, JWT access tokens, rotating refresh tokens, user-owned sessions, email
two-step challenges, and recovery codes. It does not own user persistence, RBAC definitions, SMTP
delivery, social login, or trusted devices.

## Structure and public surface

The module follows `controller -> service -> concrete repository -> TypeORM`. It consumes only the
public `UsersService` and `MailService` surfaces. Auth entities, repositories, DTOs, hashes, and raw
tokens remain private. `AuthModule` and `AuthService` are the only exports.

The global access-token guard treats a missing bearer header as anonymous so public endpoints remain
available. When a bearer header exists it verifies signature, issuer, audience, expiry, session,
user status, and `authVersion`, then builds permissions from current persisted roles. Protected
controllers still use `RequireAuthenticated` or `RequirePermissions`; anonymous access is rejected
by `PermissionsGuard`.

## API contracts

All routes use explicit URI version `v1`. Registration and recovery responses never expose raw
action tokens or reveal whether a recovery email address exists.

| Method | Route                                              | Success | Principal errors                                                                 |
| ------ | -------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| POST   | `/auth/register`                                   | 201     | 409 `EMAIL_ALREADY_REGISTERED`, 422                                              |
| POST   | `/auth/verification/resend`                        | 200     | 422                                                                              |
| POST   | `/auth/verification/confirm`                       | 200     | 401 `INVALID_OR_EXPIRED_TOKEN`, 403 `ACCOUNT_SUSPENDED`, 422                     |
| POST   | `/auth/login`                                      | 200     | 401 `INVALID_CREDENTIALS`/`ACCOUNT_LOCKED`, 403 `EMAIL_NOT_VERIFIED`/`SUSPENDED` |
| POST   | `/auth/login/two-step`                             | 200     | 401 invalid challenge/code/recovery/attempt limit, 403 suspended                 |
| POST   | `/auth/refresh`                                    | 200     | 401 `INVALID_REFRESH_TOKEN`/`REFRESH_TOKEN_REUSED`, 422                          |
| POST   | `/auth/forgot-password`                            | 200     | 422                                                                              |
| POST   | `/auth/reset-password`                             | 200     | 401 `INVALID_OR_EXPIRED_TOKEN`, 422                                              |
| POST   | `/auth/change-password`                            | 200     | 401 `UNAUTHORIZED`/`INVALID_CREDENTIALS`, 422                                    |
| POST   | `/auth/two-step/enable/request`                    | 200     | 401 auth/password, 409 already enabled, 422                                      |
| POST   | `/auth/two-step/enable/confirm`                    | 200     | 401 challenge/code/attempt limit, 422                                            |
| POST   | `/auth/two-step/disable/request`                   | 200     | 401 auth/password, 409 not enabled, 422                                          |
| POST   | `/auth/two-step/disable/confirm`                   | 200     | 401 challenge/code/attempt limit, 422                                            |
| POST   | `/auth/two-step/recovery-codes/regenerate/request` | 200     | 401 auth/password, 409 not enabled, 422                                          |
| POST   | `/auth/two-step/recovery-codes/regenerate/confirm` | 200     | 401 challenge/code/attempt limit, 422                                            |
| POST   | `/auth/logout`                                     | 204     | 401 `UNAUTHORIZED`                                                               |
| GET    | `/sessions`                                        | 200     | 401, 422                                                                         |
| DELETE | `/sessions/:id`                                    | 204     | 400, 401, 404 `SESSION_NOT_FOUND`                                                |
| DELETE | `/sessions`                                        | 204     | 401                                                                              |

The session collection uses canonical offset pagination. Every Swagger route contains concrete
success payloads and exact examples for each reachable stable error.

`POST /auth/login` returns a token pair when two-step is disabled. When enabled it returns an
explicit `requiresTwoStep` challenge instead and creates no session. Completion accepts exactly one
of two documented bodies: a six-digit email code or a recovery code. Challenges expire after five
minutes and commit failed attempts before returning errors. Refresh rotation never challenges again.

Enrollment and disablement require both the current password and a separately emailed confirmation
code. Enrollment returns ten recovery codes exactly once; only Argon2id hashes are stored. Recovery
codes are single-use, regeneration invalidates every old code, and no trusted-device bypass exists.
Enabling/disabling increments `authVersion` and revokes every session.

## Data and migrations

`auth_sessions` holds user ownership, issuing `authVersion`, last use, absolute expiry, and
revocation reason. `auth_refresh_tokens` is append-only across rotations: each opaque token is stored
only as its SHA-256 hash and marked active, rotated, or revoked. Reuse of any non-active token
revokes the owning session. `auth_action_tokens` stores hashed, expiring, single-use verification and
reset tokens; issuing a replacement consumes earlier live tokens of the same purpose.

`auth_two_step_challenges` stores a hashed opaque challenge token, Argon2id code hash, bounded
attempt count, purpose, expiry, and consumption time. `auth_recovery_codes` stores only Argon2id
hashes and consumption time.

Services own transactions and repositories own locks and queries. Session-limit enforcement revokes
least-recently-used sessions before creating the sixth default session. Password changes and resets
increment user `authVersion` and revoke every session. A per-user PostgreSQL advisory transaction
lock serializes concurrent session creation so the configured maximum cannot be exceeded by races.

## Security and observability

Passwords are capped at 128 characters before Argon2id processing and use OWASP-compatible
parameters (`m=19456`, `t=2`, `p=1`). Access tokens use HS256 with a mandatory 32-character minimum
secret, fixed issuer/audience, 15-minute default expiry, random JTI, session ID, and auth version.
Refresh and action tokens use 32 cryptographically random bytes and are never stored raw.

Email codes contain six cryptographically generated digits. Recovery codes contain 64 random bits,
are formatted for manual entry, and are never returned after enrollment/regeneration completes.

Unknown-email login performs dummy Argon2 verification. Five failed attempts lock an account for 15
minutes by default. Audit events receive request and correlation IDs; logs and mail-job metadata
never contain passwords, raw tokens, or full recipient addresses.

## Test strategy and change impact

Unit tests cover Argon2/JWT operations, registration, generic recovery, token consumption, lockout,
login, session limits, rotation/reuse, auth-version invalidation, ownership, guards, Swagger
delegation, and password revocation. Migration validation and E2E tests run against PostgreSQL and
Redis. Rollback removes auth-owned tables only; users and RBAC remain intact.

## Cursor pagination rationale

Not applicable. User session history is bounded and uses offset pagination; no measured high-volume
or stable append traversal requirement justifies cursor pagination.

**Navigation:** [Previous: Shared Foundation Standard](../shared-foundation.md) | [Documentation Index](../../README.md) | [Next: Authorization Module](authorization.md)
