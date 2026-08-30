# Architecture Overview

The application is a production-oriented, single-tenant NestJS modular monolith. PostgreSQL is the
system of record and Redis provides platform coordination. The reference profile includes users,
fixed RBAC, credential authentication, rotating sessions, email two-step verification, recovery
codes, team invitations, feature flags, transactional mail/outbox delivery, and a reusable files
module with authenticated feature-owned tus uploads, private local/S3 storage, stable public
identifiers, online provider migration, and a separate cleanup worker. Business features never
access providers or file persistence directly.
The users module is the first consumer: it owns authenticated avatar upload routes and profile
authorization while the files module owns byte transfer, sanitization staging, file-row state, and
post-commit cleanup.

Platform code owns bootstrap, validated configuration, errors, logging, database and Redis
connectivity, health, security defaults, and reusable HTTP behavior. Business behavior belongs to
feature modules under `src/modules`.

Executable Nest applications are grouped under `src/apps` so process composition does not clutter
the feature and platform roots:

```text
src/apps/
  api/              HTTP application bootstrap and root module
  mail-worker/      SMTP queue consumer application
  file-worker/      file cleanup queue consumer application
  files-migration/  explicitly invoked storage-provider migration CLI
  maintenance-worker/ bounded operational-retention process
  openapi/           build-time OpenAPI document generator
  outbox-worker/     transactional outbox relay process
```

Each folder owns only its process entrypoint and composition module; reusable behavior stays in the
owning platform or feature module. Add another process only with a concrete queue, scheduler, CLI,
or build-time composition requirement.

The standard feature flow is:

```text
controller -> service -> concrete repository -> TypeORM
```

The project does not use DDD layers, repository interface/adapter pairs, use-case-per-file classes,
or speculative mappers. Architecture-changing exceptions require an ADR and owner review.

Business routes use explicit URI versions such as `/api/v1`. Operational health endpoints remain
version-neutral and outside the API prefix. The system is explicitly single-tenant: do not add
tenant context, tenant columns, or tenant abstractions without a separately approved change.

Capability boundaries are recorded in the machine-readable
[`capabilities.manifest.json`](../../capabilities.manifest.json). The initializer currently emits
the full reference profile only; selective profiles are disabled until generated-project
validation exists. The support contract and dependency rules are documented in the
[capability matrix](../governance/capability-matrix.md) and
[ADR-001](../adr/001-optional-capability-boundaries.md).

**Navigation:** [Previous: Documentation Index](../README.md) | [Documentation Index](../README.md) | [Next: Technology Stack](tech-stack.md)
