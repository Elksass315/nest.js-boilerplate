# Repository Working Agreement

This repository is a single-tenant NestJS modular monolith. Read `README.md`, `docs/README.md`, and
`CONTRIBUTING.md` before changing behavior or structure. Rules in a closer `AGENTS.md` add to these
repository-wide rules.

## Write Safety: Check the Branch First

- Before editing, generating, formatting, staging, or committing, run `git status --short --branch`
  and `pnpm branch:write-check`.
- Never write on `main` or `develop`. Never bypass this rule with hook flags or by editing first and
  moving changes later.
- Start `feature/*`, `fix/*`, `refactor/*`, or `chore/*` from an up-to-date `develop`. Use
  `release/*` or `hotfix/*` only for an explicitly requested release workflow.
- If the branch is protected, detached, unexpectedly dirty, or based on the wrong branch, stop and
  correct it without discarding user changes.

## Mandatory Engineering Rules

- Use Node 24.19.0 and pnpm 11.21.0 through Corepack. Do not create another lockfile.
- Keep TypeScript strict. Never use `any`, unsafe casts to silence errors, or ignored promises.
- Keep changes focused. Do not add dependencies, layers, abstractions, or shared utilities without
  a concrete current use.
- Validate every external input. Never return TypeORM entities as API contracts.
- Use `ConfigService`; never hardcode credentials, environment-specific hosts, or secrets.
- Use structured logging with correlation context. Never use `console.*` or log secrets, tokens,
  cookies, passwords, or raw personal data.
- Preserve `x-request-id` for one request and `x-correlation-id` across related work. Propagate the
  correlation ID into background jobs, audit events, and outbound calls.
- Use migrations for schema changes. Never enable TypeORM synchronization.
- Do not run migrations or seeds from the API startup path.
- Update tests and authoritative documentation when behavior, contracts, security, deployment, or
  architecture changes.
- Treat documentation as part of the implementation. Update the relevant `docs/` source of truth
  in the same commit; never leave documentation work for a later unspecified change.
- Every controller declares an explicit URI version. Operational controllers use
  `VERSION_NEUTRAL`; business controllers use the owned API version constant.
- Every route has Swagger operation metadata and documents every applicable success and error
  status with a description and concrete response payload example. Document the exact stable error
  code and client-visible message for each failure condition.
- Every request DTO property has validation and Swagger examples. When an endpoint accepts
  meaningfully different request shapes, document each shape as a named `@ApiBody` example.
- Every business collection endpoint is paginated. Use page/limit by default; cursor pagination
  requires a documented high-volume or stable-traversal reason. Never return a raw array.
- Put application policy in `src/core`, Nest/HTTP primitives in `src/common`, proven framework-light
  reuse in `src/shared`, and ambient declarations in `src/types`. Do not create generic buckets.
- Do not claim completion until the relevant checks pass. Run `pnpm validate` for repository
  changes; also run e2e and Docker validation when platform wiring changes.

## Dependency Policy

- Prefer the platform and existing dependencies before adding a package.
- Add exact versions only; let pnpm update `pnpm-lock.yaml`.
- Verify maintenance status, license, transitive footprint, Node compatibility, and advisories.
- Do not introduce packages for auth, queues, mail, storage, media, or WebSockets before their
  feature phase.

## Code Review Rules

- Flag controller business logic, controller-to-repository calls, direct cross-feature persistence
  access, entity responses, missing DTO validation, swallowed errors, and missing failure tests.
- Flag secrets, permissive production defaults, unbounded retries, automatic startup migrations,
  mutable deployment image tags, and logs containing sensitive fields.
- Flag DDD-style domain/application/infrastructure folders or repository interface/adapter pairs
  unless an approved ADR demonstrates a current need.
- Flag unversioned controllers, undocumented response statuses, response docs without payload
  examples, generic error descriptions that omit code/message behavior, and stale module/API docs.
- Treat generated code as untrusted and verify it against the same rules and commands.
