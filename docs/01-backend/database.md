# Database, Migration, and Seed Standard

PostgreSQL is the system of record. TypeORM synchronization and automatic migration/seed startup are
disabled in every environment.

Use the Node migration wrapper with a lower-case kebab-case name. It refuses duplicate names and
loads database configuration only. Schema changes use reviewed migrations with a safe `down`, or a
documented forward-fix decision when reversal is unsafe. CI migration validation is restricted to a
database whose name ends in `_test`.

Normal entities extend `AppBaseEntity`. Feature repositories remain concrete and private; services
own transactions and controllers never access persistence.

Reference/bootstrap data uses the explicit ordered seed registry. Applied seeds have immutable IDs
and checksums in `app_seed_history`. The runner holds a PostgreSQL advisory lock and commits each seed
with its history record in one transaction. Editing an applied seed fails; add a new seed instead.
Run `pnpm seed:show` or `pnpm seed:run` only as explicit one-shot deployment steps.

Migration `1787011200000-CreateTeamInvitations` adds invitation lifecycle metadata, foreign keys,
bounded send counts, expiry indexes, and one pending invitation per normalized email. Immutable seed
`003-team-invitations-rbac` adds the corresponding fixed RBAC permissions. Invitation tokens persist
only as SHA-256 hashes; creation, resend, and revoke use service-owned transactions and row locks.

**Navigation:** [Previous: Configuration Standard](configuration.md) | [Documentation Index](../README.md) | [Next: Migrations and Seeds](migrations.md)
