# v1 Readiness and Recovery Record

## Release gates

- `pnpm validate` passes, including architecture, documentation, dependency, license, advisory,
  coverage, and build gates.
- Unit, E2E, migration, seed, worker, SMTP, S3, Compose, image, secret, and security checks pass
  in CI with the documented managed-service substitutes.
- `pnpm readiness:check` confirms the manifest, provenance marker, migration compatibility contract,
  governance documents, initializer, and deployment backup gate.
- A clean checkout initializes and validates the full reference profile. Selective profiles remain
  disabled until clean-checkout generation and validation are added for every advertised profile.

## Managed deployment rehearsal

Use an immutable image digest and externally managed PostgreSQL, Redis, S3, SMTP, secrets, and OTLP.
Before migrations, record `BACKUP_REFERENCE`; run the migration and seed jobs, then start the API,
mail, file, outbox, and maintenance workers from the same image. Verify heartbeats, API readiness,
queue connectivity, SMTP TLS, and private object storage. Capture the deployment record and smoke
test results. A rollback attempt must fail closed when compatibility is not declared.

## Backup restoration drill

At least quarterly, restore a managed PostgreSQL PITR backup into an isolated environment, record the
backup point and elapsed restore time, run migrations/seed compatibility checks, and execute API,
authentication, queue, and data-integrity smoke tests. Compare the recovered point with the 15-minute
RPO target and the full recovery duration with the 4-hour RTO target. Record gaps and remediation
owners before closing the drill.

| Evidence                           | Status              | Owner                  | Link or record     |
| ---------------------------------- | ------------------- | ---------------------- | ------------------ |
| Full validation and security scans | Pending per release | Application team       | CI run             |
| Clean initializer exercise         | Pending per release | Template maintainers   | Initializer report |
| Managed deployment rehearsal       | Pending per release | Platform team          | Deployment record  |
| PITR restore drill                 | Quarterly           | Database/platform team | Recovery report    |

**Navigation:** [Previous: CI/CD Ownership](ci-cd.md) | [Documentation Index](../README.md) | [Next: Documentation Policy](../governance/documentation-policy.md)
