# Architecture Rules

- Preserve `controller -> service -> concrete repository -> TypeORM`.
- Controllers contain HTTP concerns only and never call repositories.
- Services own workflows and transactions; repositories own database queries.
- Features expose intentional services/contracts through `index.ts`; internal persistence stays private.
- Do not create DDD layers, repository interfaces, adapters, use-case classes, or mappers without a
  present requirement and approved ADR.
- Do not create generic shared buckets or cross-feature persistence channels.
- Keep TypeScript strict, TypeORM synchronization disabled, and migrations outside API startup.
- Version controllers explicitly and maintain complete Swagger and module documentation.
- Declare every route explicitly public, authenticated, or permission-protected; protected policy
  decorators install their runtime guard and the architecture check rejects implicit access.
- Enforce purpose-specific core/common/shared/types boundaries and canonical collection pagination.
- Propagate correlation IDs through all related synchronous and asynchronous work.

`pnpm arch:check` enforces dependency boundaries and API-controller contract metadata. Intentional
exceptions require an ADR documenting evidence, risk controls, validation, and rollback.

**Navigation:** [Previous: Documentation Policy](documentation-policy.md) | [Documentation Index](../README.md) | [Next: Module Documentation Template](../templates/module-doc-template.md)
