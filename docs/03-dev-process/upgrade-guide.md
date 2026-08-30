# Upgrade and Rollback Guide

Template and application upgrades use additive expand/contract migrations.

1. Create a backup and record its provider reference as `BACKUP_REFERENCE`.
2. Confirm the new image declares `expand-contract-v1` compatibility and deploy the expand phase.
3. Run migrations, seed only when the release requires it, and verify API and worker smoke checks.
4. Deploy the new API and all workers from the same immutable image.
5. After the compatibility window, remove obsolete columns or constraints in a later contract release.

Rollback is refused when the previous image does not declare migration compatibility. Restore the
recorded backup first when schema recovery is required, then deploy an image known to understand
the restored schema. Never run automatic down migrations in production.

Capability changes are additive: use `pnpm init:project` only on an untouched template, and treat a
generated project as an application after initialization. Removing a capability requires a planned
code, migration, configuration, worker, and data-retention change; the initializer cannot infer
arbitrary local customizations.

## Known v1 limitations

- The baseline is single-tenant and REST v1; multi-tenancy, GraphQL, Kafka, and microservices are
  outside v1.
- Production data services are externally managed; local Compose services are development/CI only.
- The initializer preserves stable contracts but cannot safely merge changes into an already
  customized project.
- Legacy avatar association data is migrated additively; existing `/users/me/avatar` behavior stays
  compatible during the transition.
- TOTP/passkeys, billing, general notifications, and speculative DDD layers are not v1 goals.

**Navigation:** [Previous: Pull-Request Review](review-process.md) | [Documentation Index](../README.md) | [Next: Docker Workflow](../04-deployment/docker.md)
