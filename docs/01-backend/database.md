# Database, Migration, and Seed Standard

PostgreSQL is the system of record. TypeORM synchronization and automatic migration/seed startup are
disabled in every environment.

Use the Node migration wrapper with a lower-case kebab-case name. It refuses duplicate names and
loads database configuration only. The wrapper invokes TypeORM through the repository's pinned pnpm
toolchain, so the commands behave consistently when started through either `pnpm run` or `npm run`.
Schema changes use reviewed migrations with a safe `down`, or a documented forward-fix decision when
reversal is unsafe. CI migration validation is restricted to a database whose name ends in `_test`.

Normal entities extend `AppBaseEntity`. Feature repositories remain concrete and private; services
own transactions and controllers never access persistence.

The transactional outbox is part of the database contract. Business transactions may insert typed
outbox messages through the caller's `EntityManager`; the separate outbox worker later publishes
them to BullMQ with lease-based claiming and idempotent message IDs. Outbox status and retry are
explicit CLI operations, never HTTP administration endpoints.

Reference/bootstrap data uses the explicit ordered seed registry. Applied seeds have immutable IDs
and checksums in `app_seed_history`. The runner holds a PostgreSQL advisory lock and commits each seed
with its history record in one transaction. A seed whose ID is already recorded is skipped, so running
`pnpm seed:run` again does not execute it twice; the runner logs the skip explicitly. Editing an applied
seed fails; add a new seed instead. Run `pnpm seed:show` or `pnpm seed:run` only as explicit one-shot
deployment steps.

The RBAC seeds never contain administrator credentials. After migrations and seeds have completed,
run `pnpm auth:bootstrap-admin` once from an interactive terminal to create the first active,
verified super-admin. The command hashes the prompted password, refuses to modify an existing user,
refuses to run when an active super-admin already exists, and records an audit event. Do not put
bootstrap passwords in seed files, committed environment files, or API requests.

Migration `1787011200000-CreateTeamInvitations` adds invitation lifecycle metadata, foreign keys,
bounded send counts, expiry indexes, and one pending invitation per normalized email. Immutable seed
`003-team-invitations-rbac` adds the corresponding fixed RBAC permissions. Invitation tokens persist
only as SHA-256 hashes; creation, resend, and revoke use service-owned transactions and row locks.
Migration `1787097600000-IndexInvitationTokenHash` adds the unique token-hash lookup required for
locked, single-use acceptance. Acceptance commits the active user, fixed-role assignment, correlated
audit, and invitation transition together; a uniqueness race rolls back the entire transaction.

Migration `1787184000000-IndexSecurityAuditPagination` supports deterministic personal and
cross-user security-audit pages. Immutable seed `004-security-audit-rbac` adds the dedicated
cross-user permission to the super-administrator role without changing earlier seed checksums.

Migration `1787270400000-CreateFeatureFlags` adds global flag definitions with optimistic versions
and append-only change audits containing request/correlation context. Creation and effective state
changes write the flag and audit in one transaction. Immutable seed `005-feature-flags-rbac` adds
read and management permissions but intentionally creates no project-specific flags.

Migration `1787356800000-CreateEmailVerificationCodes` replaces registration link persistence with
dedicated Argon2id-hashed OTP rows and an indexed, row-locked active-code lookup. Its forward
migration intentionally deletes legacy verification-link rows while retaining pending users; those
users recover by resubmitting registration. The schema rollback restores the legacy action-token
purpose constraint but cannot reconstruct deleted raw verification credentials.

Migration `1787443200000-AddSessionMetadata` adds nullable IP, user-agent, device metadata, and
approximate location fields to `auth_sessions`; existing sessions remain valid with null metadata.

`email_two_step_enabled` stores voluntary enrollment only. Administrator requirements are derived
from current role assignments and never rewrite this column, including invitations, bootstrap,
promotion, and demotion.

Migration `1787529600000-CreateUserPermissionOverrides` creates grant/revoke rows owned by users
and catalog permissions. Immutable seed `006-user-permission-overrides-rbac` grants only
`super_admin` the `users.permissions.manage` permission.

Migration `1787702400000-CreateUserAvatarAssociations` creates the optional
`user_avatar_associations` table, enforces one association per user and file, backfills existing
avatar references, and preserves a reversible down migration. It is additive: the legacy
`users.avatar_file_id` column remains for v1 response compatibility while the public
`UserAvatarsService` becomes the generator boundary.

Operational retention uses existing timestamp/status indexes and bounded CTE deletes. It does not
delete security audits, feature-flag audits, or business records, and takes the
`maintenance:retention` PostgreSQL advisory transaction lock before a sweep.

Capability migrations and seeds are emitted only for selected features. The avatar compatibility
migration backfills associations before removing the legacy user column.

The outbox repository also normalizes PostgreSQL `UPDATE ... RETURNING` transaction results before
mapping claimed rows, since the PostgreSQL adapter returns a structured `[rows, rowCount]` value.

**Navigation:** [Previous: Configuration Standard](configuration.md) | [Documentation Index](../README.md) | [Next: Migrations and Seeds](migrations.md)
