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
- Name new seed files with a millisecond Unix-epoch timestamp prefix
  (`<epoch-millis>-<kebab-description>.seed.ts`), never a hand-picked sequential number. Sequential
  prefixes collide when developers on different branches independently claim the same next number
  and merge into `develop`; see `docs/01-backend/database.md`.
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
- Business features own their upload routes and authenticate every stateful upload request. They
  consume only the public `FilesService`; direct filesystem, S3 SDK, or tus-store access is
  forbidden outside `src/modules/files`. Storage keys are server-generated, files default to
  protected, and every upload uses a fixed server-side purpose policy. Preserve correlation IDs
  through upload processing, cleanup, provider migration, and owning-feature audits.
- Image consumers verify declared MIME, extension, and decoded format; bound source bytes,
  dimensions, and decoded pixels; reject animation; and decode/re-encode without metadata before
  making a file public. Never trust client metadata or publish raw uploads.
- Put application policy in `src/core`, Nest/HTTP primitives in `src/common`, proven framework-light
  reuse in `src/shared`, and ambient declarations in `src/types`. Do not create generic buckets.
- After each coding prompt, run `pnpm validate:change`. Formatting, strict lint, type checking,
  applicable focused tests, and build are mandatory blocking gates. The command selects architecture,
  i18n, documentation, tooling, dependency, and Compose gates from the actual diff and fails when a
  governed code change omits its authoritative documentation companion.
- Run full `pnpm validate` once before a PR/release handoff and whenever a change is broad, security
  sensitive, dependency-heavy, or affects shared platform policy. Also run relevant e2e, migration,
  seed, worker, SMTP, and Docker checks when those surfaces change. Do not rerun unrelated expensive
  suites after every small prompt.

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
