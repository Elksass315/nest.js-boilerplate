# Architecture Standard

## Platform shape

The application is a single-tenant NestJS modular monolith. PostgreSQL is the system of record;
Redis provides platform coordination. Multi-tenancy, auth, queues, notifications, storage, and
other business capabilities are separate future phases.

Platform code owns bootstrap, configuration, errors, logging, database/Redis connectivity, health,
security defaults, and reusable transport behavior. Business behavior belongs to feature modules.

## Feature structure

```text
src/modules/<feature>/
  index.ts
  <feature>.module.ts
  <feature>.controller.ts     # only when HTTP is needed
  <feature>.service.ts
  <feature>.repository.ts     # only when persistence is needed
  dto/                        # only when contracts exist
  entities/                   # only when persistence exists
```

The standard flow is:

```text
controller → service → concrete repository → TypeORM
```

- Controllers own route metadata, authentication/authorization decorators, request DTO binding,
  and response DTO mapping. They contain no business rules and never access repositories.
- Services own business policy, workflows, transaction boundaries, and integration orchestration.
- Concrete repositories own TypeORM repositories, query builders, locks, and persistence mapping.
- DTOs are explicit validated contracts. Entities never leave the owning feature as API responses.
- `index.ts` exports only the Nest module, service, and intentionally public contract types.

Do not add DDD `domain/application/infrastructure` folders, repository interfaces, adapter pairs,
use-case-per-file classes, or mapping layers without a documented present requirement and ADR.

## Boundaries

- A feature may consume another feature only by importing its public index, importing its Nest
  module, and injecting an exported service.
- A feature may not import another feature's entity, repository, internal DTO, or implementation.
- Cross-cutting code is accepted into `src/common` only when at least two real features use it and
  it carries no feature policy.
- Database schema changes are migration-only. `synchronize` remains false in every environment.
- Background processing will be added with its first real asynchronous feature, not speculatively.

`pnpm arch:check` enforces circular dependency, controller/repository, and cross-feature rules.

## Platform HTTP contract

Business APIs use `/api/v1`. Operational endpoints stay unversioned:

- `GET /health/live`: process status only.
- `GET /health/ready`: PostgreSQL and Redis readiness; returns 503 if either is unavailable.

Errors use a stable envelope containing `statusCode`, `code`, `message`, `timestamp`, `path`, and
`requestId`, with safe optional details. Request IDs are accepted only from a constrained header
format; otherwise the platform generates one.

Architecture-changing decisions use `docs/adr/000-template.md` and require owner review.
