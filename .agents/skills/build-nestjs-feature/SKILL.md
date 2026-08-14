---
name: build-nestjs-feature
description: Create or change business feature modules, endpoints, collection APIs, DTOs, entities, repositories, migrations, seeds, Swagger contracts, or cross-feature interactions in this NestJS SaaS repository. Enforce the controller-service-concrete-repository architecture, canonical pagination, translated stable errors, correlation propagation, documentation, and validation. Do not use for platform-only Docker, CI, or dependency maintenance.
---

# Build a NestJS Feature

Build the smallest complete feature that satisfies the request. Preserve flat module boundaries and
never introduce DDD layers speculatively.

## Workflow

1. Inspect `git status --short --branch` and run `pnpm branch:write-check` before every write. Never
   modify `main`, `develop`, or a release branch directly.
2. Read the root and module `AGENTS.md` files, the module architecture and OpenAPI standards, the
   pagination standard, and [the feature checklist](references/feature-checklist.md).
3. Inspect related public indexes, contracts, migrations, seeds, errors, translations, tests, and
   module docs. Reuse established platform behavior through its public surface.
4. Preview new features with
   `pnpm scaffold:feature <kebab-name> [--http] [--persistence] --dry-run`. Generate only requested
   HTTP and persistence files, refuse overwrites, and delete unused placeholders.
5. Keep HTTP binding in controllers, workflows and transactions in services, and TypeORM queries
   and locks in concrete repositories. Use `AppBaseEntity`; use soft deletion only when required.
6. Keep entities, repositories, and internal DTOs private. Export only the module, service, and
   intentional public contracts from `index.ts`. Import another feature only through its index.
7. For every collection route, use offset page/limit by default. Use cursor pagination only for a
   documented high-volume, append-oriented, or stable-traversal need. Never return a raw array.
8. Version every controller. Document every reachable status with a concrete payload, exact stable
   error code/message, and named examples for distinct body shapes. Keep implementation, tests,
   translations, Swagger, and module docs aligned.
9. Register stable errors centrally, supply English translations, validate every external input,
   map entities to response DTOs, and preserve request/correlation IDs in logs, jobs, audits, and
   outbound work.
10. Add explicit migrations and immutable ordered seeds when stored state or reference data changes.
    Never enable synchronization or run migrations/seeds during API startup.
11. For file consumers, keep upload routes in the consuming feature, authenticate every stateful
    tus request, and call only the public `FilesService`. Define a fixed purpose/size/MIME policy;
    never accept a client storage key or import filesystem, S3, tus-store, file repository, or file
    entity internals. Propagate request/correlation IDs through processing, cleanup, migration, and
    owning-feature audits.
12. After each coding prompt, run `pnpm validate:change`. Formatting, strict lint, type checking,
    applicable focused tests, and build are mandatory blocking gates. It adds architecture, i18n,
    docs, tooling, dependency, and Compose checks from the diff and rejects governed changes missing
    their authoritative documentation companion. Run full `pnpm validate` once before PR/release
    handoff or for broad and high-risk work. Add relevant e2e, migration, seed, worker, SMTP, or
    Docker checks when those surfaces changed. Report unavailable external checks precisely.

## Hard boundaries

- Do not create `domain`, `application`, `infrastructure`, adapter, use-case, or mapper layers by
  default.
- Do not define a repository interface for one persistence implementation.
- Do not put business rules or database access in controllers.
- Do not import another feature's entity, repository, or internal path.
- Do not expose entities, raw arrays, or undocumented pagination contracts.
- Do not add generic utility buckets or packages that existing platform code replaces.
- Do not add generic upload endpoints, unauthenticated stateful uploads, client-selected storage
  keys, or direct storage-provider access outside the files module.
- Do not hand off stale Swagger, error translations, module docs, configuration examples, or tests.
