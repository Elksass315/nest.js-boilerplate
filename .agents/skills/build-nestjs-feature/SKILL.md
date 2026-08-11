---
name: build-nestjs-feature
description: Create or change feature modules in this NestJS SaaS repository using its controller-service-concrete-repository architecture. Use when adding a new business feature, endpoint, DTO, entity, TypeORM repository, migration, or cross-feature interaction under src/modules. Do not use for platform-only Docker, CI, documentation, or dependency maintenance.
---

# Build a NestJS Feature

Build the smallest complete feature that satisfies the request while preserving this repository's
flat module boundaries. Never introduce DDD layers speculatively.

## Workflow

1. Read the root and `src/modules/AGENTS.md`, then read `docs/architecture.md` and
   [the feature checklist](references/feature-checklist.md).
2. Inspect related modules, public indexes, contracts, migrations, and tests before designing the
   change. Reuse established platform behavior.
3. For a new feature, preview the deterministic scaffold:

   ```bash
   pnpm scaffold:feature <kebab-name> [--http] [--persistence] --dry-run
   ```

   Run it without `--dry-run` only after confirming the target does not exist. Use `--http` only
   for an HTTP surface and `--persistence` only for stored state.

4. Implement transport concerns in the controller, business workflow in the service, and TypeORM
   access in the concrete repository. Delete unused generated placeholders rather than preserving
   them for possible future work.
5. Keep entities, repositories, and internal DTOs private. Export only the Nest module, service,
   and intentional public contracts from `index.ts`. Consume another feature only through its
   public index and exported service.
6. Add validated request DTOs, explicit response DTOs, Swagger metadata, stable errors, structured
   safe logs, and a migration whenever the feature requires them.
7. Test business rules and failures at service level, controller delegation/contracts at transport
   level, repository queries with PostgreSQL when meaningful, and the public workflow with e2e
   coverage.
8. Run formatting, focused tests, `pnpm arch:check`, `pnpm typecheck`, and then `pnpm validate`.
   Report any unavailable external-service check precisely.

## Hard boundaries

- Do not create `domain`, `application`, `infrastructure`, adapter, use-case, or mapper layers by
  default.
- Do not define a repository interface when there is only one concrete persistence mechanism.
- Do not put business rules or database access in controllers.
- Do not import another feature's entity, repository, or internal path.
- Do not expose entities as response contracts or enable TypeORM synchronization.
- Do not add a package when the platform or a small local implementation already solves the need.
