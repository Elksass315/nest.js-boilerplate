# Migrations and Seeds

Identity migration `1786579200000-CreateIdentityCore` creates users, role assignments, security
audits, roles, permissions, and role-permission mappings with explicit checks, indexes, and foreign
keys. Seed `002-rbac` installs deterministic fixed RBAC definitions. The seed contains no user or
bootstrap-super-admin credentials. After migrations and seeds, create the first administrator with
the interactive one-shot `pnpm auth:bootstrap-admin` command. It requires a TTY for password input,
refuses to modify an existing user, refuses to run when an active super-admin already exists, and
records a `user.created` audit event. Never put bootstrap credentials in seed files or commit them to
environment configuration.

Auth migration `1786665600000-CreateAuthSessions` creates absolute-lifetime sessions, append-only
rotating refresh-token records, and the original single-use verification/reset action tokens. Unique token
hashes, status/purpose checks, ownership foreign keys, and stable session indexes are enforced in
PostgreSQL. Only SHA-256 token hashes are stored. Migration reversal removes auth action tokens,
refresh tokens, then sessions without modifying users or RBAC state.

Identity email-security migration `1786752000000-CreateIdentityEmailSecurity` creates hashed,
expiring two-step challenges, hashed single-use recovery codes, and mail-delivery state. Delivery
records store only a SHA-256 recipient fingerprint plus a masked address; queue payloads retain the
full recipient only for the bounded Redis job lifetime. Reversal removes these three owned tables.

Email-verification migration `1787356800000-CreateEmailVerificationCodes` invalidates legacy
email-verification link rows, restricts action tokens to password reset, and creates dedicated
Argon2id-hashed six-digit code state with attempts, expiry, consumption, ownership, and an active
lookup index. Existing pending accounts remain and can resubmit registration to receive a new code.
Reversal restores the legacy purpose constraint but cannot restore invalidated raw link tokens.

Session metadata migration `1787443200000-AddSessionMetadata` adds nullable IP address, user-agent,
device metadata, and approximate location JSON fields to `auth_sessions`. Existing sessions remain
valid with null metadata; reversal drops only these four columns.

File migration `1786838400000-CreateFileStorage` creates `stored_files` with provider/key and public
identifier uniqueness, lifecycle/visibility/provider checks, uploader ownership, expiry indexes,
checksums, safe failure state, and correlation context. Online provider moves are separate explicit
commands, hold their own advisory lock, process bounded ready-file batches, and never run during API,
worker, schema migration, seed, or deployment startup. The row retains a pending old-provider/key
pair until source deletion succeeds so interrupted moves remain readable and recoverable.

Avatar migration `1786924800000-AddUserAvatar` adds nullable, unique `users.avatar_file_id` with a
foreign key to `stored_files` and `ON DELETE SET NULL`. The migration imports neither feature
entity; users and files continue to access persistence only through their owning repositories and
public services. Reversal drops the foreign key, uniqueness constraint, and column without deleting
stored bytes.

Security-center migration `1787184000000-IndexSecurityAuditPagination` replaces the initial
security-audit subject/time index with `(user_id, created_at, id)`, matching newest-first offset
pagination with a unique tie-breaker. Its reversal restores the original index. Immutable seed
`004-security-audit-rbac` grants cross-user audit lookup only to the fixed `super_admin` role.

**Navigation:** [Previous: Database, Migration, and Seed Standard](database.md) | [Documentation Index](../README.md) | [Next: Error Handling](error-handling.md)
