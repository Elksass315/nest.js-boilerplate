# Database and Migration Standard

PostgreSQL is the system of record. TypeORM synchronization stays disabled in every environment.
All schema changes use reviewed migrations; the API never runs migrations or seeds during startup.

Feature repositories are concrete classes private to their owning module. Controllers never access
repositories. Cross-feature persistence access is forbidden. Add database constraints and indexes
for real invariants, keep migrations deterministic, and test execution/reversion or document a
forward-fix-only decision when reversal would be unsafe.

Deployment runs a one-shot migration job before application rollout and rolls back the application
digest—not an automatically destructive database migration—when readiness or smoke checks fail.
