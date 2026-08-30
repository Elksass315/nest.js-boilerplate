# Operational Ownership Checklist

The deploying company owns the application runtime and coordinates with managed-service owners.
Every production release records evidence for the checks below.

| Surface                   | Primary owner                | Required evidence                                              | Escalation                     |
| ------------------------- | ---------------------------- | -------------------------------------------------------------- | ------------------------------ |
| API and workers           | Application team             | Immutable image, readiness and heartbeat checks                | On-call application owner      |
| PostgreSQL                | Database/platform team       | PITR status, backup reference, migration result                | Managed database incident path |
| Redis and BullMQ          | Platform team                | Capacity/noeviction alerts, queue lag, connectivity smoke test | Cache/queue on-call            |
| S3/object storage         | Platform team                | Bucket policy, private access, provider smoke test             | Storage provider escalation    |
| SMTP                      | Communications/platform team | TLS verification, delivery and exhaustion metrics              | Mail provider escalation       |
| Secrets and configuration | Security/platform team       | Secret scan, rotation record, environment validation           | Security incident process      |
| OTLP and dashboards       | Observability team           | Export health, alert rules, cardinality review                 | Observability on-call          |
| Retention and audits      | Application team             | Maintenance dry-run/report and audit-preservation check        | Data-governance owner          |

## Release and incident checklist

- Confirm the image digest, commit, migration compatibility declaration, and `BACKUP_REFERENCE`.
- Run API, queue, SMTP, object-storage, and worker-heartbeat smoke checks after rollout.
- Verify queue lag, outbox age/failures, database pool use, throttling, mail failures, and file
  cleanup metrics.
- During an incident, preserve correlation IDs and security audits; do not delete audit records as
  part of routine retention.
- Use the previous image only when both images declare compatible expand/contract migrations.

The company default targets are RPO 15 minutes and RTO 4 hours. Managed PostgreSQL PITR is the
primary recovery mechanism. A restore drill is performed at least quarterly and records restore
start/end time, recovered backup point, data-integrity checks, and the measured RPO/RTO.

Maintenance may remove expired tokens, sessions, mail deliveries, processed outbox rows, terminal
outbox failures, and temporary file metadata according to configured bounded batches. Security
audits, feature-flag audits, and other business records require an explicit, separately approved
retention policy and are never deleted automatically by the baseline worker.

**Navigation:** [Previous: Supported Capability Matrix](capability-matrix.md) | [Documentation Index](../README.md) | [Next: Template Governance](template-governance.md)
