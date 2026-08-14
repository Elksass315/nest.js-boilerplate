# Contributing

## Branches

- `main`: production releases only.
- `develop`: integration branch for the next release.
- `feature/<kebab-case>`, `fix/<kebab-case>`, `refactor/<kebab-case>`, and
  `chore/<kebab-case>` branch from `develop` and squash back through a pull request.
- `release/<version>` branches from `develop`, deploys to staging, and merges into `main` and back
  into `develop` with merge commits.
- `hotfix/<kebab-case>` branches from `main` and merges into `main` and `develop` with merge commits.

Direct pushes to `main` and `develop` are prohibited. Required checks, review, resolved
conversations, and CODEOWNERS approval apply before merge.

Before making any repository change, confirm a writable short-lived branch:

```bash
git status --short --branch
pnpm branch:write-check
```

## Commits and releases

Use Conventional Commits:

```text
<type>(<scope>): <imperative description>
```

Allowed types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, and
`test`. Breaking changes use `!` or a `BREAKING CHANGE:` footer. Semantic Release creates the tag
and GitHub Release from commits reaching `main`; this private application is never published to npm.

## Pull requests

Explain the outcome, compatibility, operational risk, migration/rollback behavior, and verification.
Add tests for changed behavior and update contracts, architecture, security, or operations docs in
the same change. API reviews compare DTO validation, controller behavior, complete Swagger
request/response examples, exact error codes/messages, tests, and module documentation. New
dependencies must be necessary, actively maintained, compatible with Node 24, license-approved,
and clean under the repository audit.

Before requesting review, run:

```bash
pnpm validate
```

During implementation, run `pnpm validate:change` after each coding prompt. Formatting, strict lint,
type checking, applicable focused tests, and build are mandatory. The command selects additional
checks from the diff and rejects governed changes that omit their authoritative documentation files.
This fast loop does not replace the full pre-review validation above.

Also run `pnpm test:e2e` with PostgreSQL and Redis for platform changes, and validate both Compose
models when Docker or deployment files change. CI is authoritative.
