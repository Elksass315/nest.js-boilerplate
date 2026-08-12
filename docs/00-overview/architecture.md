# Architecture Overview

The application is a production-oriented, single-tenant NestJS modular monolith. PostgreSQL is the
system of record and Redis provides platform coordination. Phase 2 includes users, fixed RBAC,
credential authentication, rotating sessions, and a mail-job producer. Two-step verification, the
SMTP worker, general notifications, storage, billing, and other capabilities remain deferred.

Platform code owns bootstrap, validated configuration, errors, logging, database and Redis
connectivity, health, security defaults, and reusable HTTP behavior. Business behavior belongs to
feature modules under `src/modules`.

The standard feature flow is:

```text
controller -> service -> concrete repository -> TypeORM
```

The project does not use DDD layers, repository interface/adapter pairs, use-case-per-file classes,
or speculative mappers. Architecture-changing exceptions require an ADR and owner review.

Business routes use explicit URI versions such as `/api/v1`. Operational health endpoints remain
version-neutral and outside the API prefix. The system is explicitly single-tenant: do not add
tenant context, tenant columns, or tenant abstractions without a separately approved change.
