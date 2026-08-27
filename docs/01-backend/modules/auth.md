# Auth and Sessions Module

## Purpose and scope

`auth` owns registration orchestration, email-verification codes and password-reset tokens, credential
checks, temporary lockout, JWT access tokens, rotating refresh tokens, user-owned sessions, email
two-step challenges, and recovery codes. It does not own user persistence, RBAC definitions, SMTP
delivery, social login, or trusted devices.

## Structure and public surface

The module follows `controller -> service -> concrete repository -> TypeORM`. It consumes only the
public `UsersService` and `MailService` surfaces. Auth entities, repositories, DTOs, hashes, and raw
tokens remain private. `AuthModule` and `AuthService` are the only exports.

`AuthService.hashAccountPassword` is the intentional cross-feature hashing surface used by
invitation acceptance. It applies the same Argon2id policy as registration and never exposes the
crypto provider or password hash through HTTP.

The global access-token guard treats a missing bearer header as anonymous so public endpoints remain
available. When a bearer header exists it verifies signature, issuer, audience, expiry, session,
user status, and `authVersion`, then builds permissions from current persisted roles. Protected
controllers still use `RequireAuthenticated` or `RequirePermissions`; anonymous access is rejected
by `PermissionsGuard`.

## API contracts

All routes use explicit URI version `v1`. Registration returns the account UUID as a public
`registrationId` plus code expiry. Resend and recovery responses never expose raw secrets or reveal
whether an eligible account exists.

| Method | Route                                              | Success | Principal errors                                                                 |
| ------ | -------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| POST   | `/auth/register`                                   | 201     | 409 `EMAIL_ALREADY_REGISTERED`, 422                                              |
| POST   | `/auth/verification/resend`                        | 200     | 422                                                                              |
| POST   | `/auth/verification/confirm`                       | 200     | 401 invalid/expired code or attempts exceeded, 403 `ACCOUNT_SUSPENDED`, 422      |
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

The session collection uses canonical offset pagination and accepts an optional `revoked` boolean
query filter (`true` or `false`). Every Swagger route contains concrete success payloads and exact
examples for each reachable stable error. Session records include the creation IP, user-agent,
coarse device metadata, and approximate country/region/city when trusted proxy headers provide it;
missing metadata is returned as `null`.

`POST /auth/register` creates a pending user or revises the name/password of an existing pending
user with the same normalized email. It invalidates earlier codes, emails a six-digit code, and
returns `{ registrationId, verificationExpiresIn, message }`. Active and suspended duplicates
remain `EMAIL_ALREADY_REGISTERED`; a different email creates a separate pending registration.
Resend accepts `{ registrationId }`; confirmation accepts `{ registrationId, code }`.

Verification codes expire after ten minutes and allow five failed attempts. The fifth failure
consumes the code and returns `VERIFICATION_ATTEMPTS_EXCEEDED`; invalid, expired, superseded, and
consumed codes use `INVALID_OR_EXPIRED_VERIFICATION_CODE`. Resend uses a generic response for
unknown or ineligible registration IDs.

`POST /auth/login` returns tokens plus a nested safe user profile when neither enrollment nor role
policy requires two-step. The
profile matches `/users/me` and adds current deduplicated permission keys. When enabled it returns an
explicit `requiresTwoStep` challenge instead and creates no session. Completion accepts exactly one
of two documented bodies: a six-digit email code or a recovery code. Challenges expire after five
minutes and commit failed attempts before returning errors. Successful completion returns the same
tokens-plus-user contract as ordinary login. Refresh rotation never challenges again and continues
to return only a token pair.

Enrollment and disablement require both the current password and a separately emailed confirmation
code. Enrollment returns ten recovery codes exactly once; only Argon2id hashes are stored. Recovery
codes are single-use, regeneration invalidates every old code, and no trusted-device bypass exists.
Enabling/disabling increments `authVersion` and revokes every session.

Email two-step verification is mandatory for `admin` and `super_admin` roles. The requirement is
derived independently from the voluntary enrollment flag, so creation, promotion, and demotion do
not alter enrollment. Login challenges are issued when enrollment or role policy requires them.
User and login-user responses expose both `emailTwoStepEnabled` and `emailTwoStepRequired`.
For backward-compatible hardening, an enrolled administrator must be demoted before disabling the
voluntary factor; the role policy continues to require challenges regardless of enrollment state.

## Data and migrations

`auth_sessions` holds user ownership, issuing `authVersion`, last use, absolute expiry, revocation
reason, and nullable request metadata (`ip_address`, `user_agent`, `device_metadata`, and
`approximate_location`). `auth_refresh_tokens` is append-only across rotations: each opaque token is stored
only as its SHA-256 hash and marked active, rotated, or revoked. Reuse of any non-active token
revokes the owning session. `auth_action_tokens` stores hashed, expiring, single-use password-reset
tokens; issuing a replacement consumes earlier live reset tokens.

`auth_email_verification_codes` stores only Argon2id code hashes, attempts, expiry, and consumption
state. Issuing a code consumes every prior live code for the user.

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
secret, fixed issuer/audience, 15-minute default expiry, session ID, and auth version. They contain
no JTI, roles, or permissions; the access guard resolves current authorization on every request.
Refresh and action tokens use 32 cryptographically random bytes and are never stored raw.

Email verification and two-step codes contain six cryptographically generated digits. Recovery codes contain 64 random bits,
are formatted for manual entry, and are never returned after enrollment/regeneration completes.

Unknown-email login performs dummy Argon2 verification. Five failed attempts lock an account for 15
minutes by default. Audit events receive request and correlation IDs; logs and mail-job metadata
never contain passwords, raw tokens, or full recipient addresses.

## Test strategy and change impact

Unit tests cover Argon2/JWT operations, pending registration revision, verification code expiry,
attempts and consumption, generic recovery, token consumption, lockout, enriched login, session
limits, rotation/reuse, auth-version invalidation, ownership, guards, Swagger bearer metadata,
delegation, and password revocation. Migration validation and E2E tests run against PostgreSQL and
Redis. Rollback removes auth-owned tables only; users and RBAC remain intact.

## Cursor pagination rationale

Not applicable. User session history is bounded and uses offset pagination; no measured high-volume
or stable append traversal requirement justifies cursor pagination.

**Navigation:** [Previous: Shared Foundation Standard](../shared-foundation.md) | [Documentation Index](../../README.md) | [Next: Authorization Module](authorization.md)
