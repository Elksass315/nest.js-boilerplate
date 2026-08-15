# Documentation Policy

Documentation is a release artifact. A behavior, contract, architecture, security, configuration,
or operational change is incomplete until its authoritative documentation changes in the same pull
request.

- Feature changes update `docs/01-backend/modules/<feature>.md`.
- API changes update Swagger decorators, DTO examples, API standards/catalogs, tests, and module docs.
- Configuration changes update schema, tests, `.env.example`, configuration docs, and delivery wiring.
- Architecture decisions update the architecture standard and add an ADR when the standard changes.
- Process or deployment changes update their corresponding development/deployment document.

Reviewers block stale documentation. An exception requires explicit owner approval and a tracked,
owned, expiring remediation item. `pnpm docs:check` validates required sources, local links, and
module-document presence; reviewers validate semantic parity.

**Navigation:** [Previous: CI/CD Ownership](../04-deployment/ci-cd.md) | [Documentation Index](../README.md) | [Next: Architecture Rules](architecture-rules.md)
