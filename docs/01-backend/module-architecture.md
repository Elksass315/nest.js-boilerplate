# Feature Module Architecture

## Structure

```text
src/modules/<feature>/
  index.ts
  <feature>.module.ts
  <feature>.controller.ts     # only for HTTP
  <feature>.service.ts
  <feature>.repository.ts     # only for persistence
  dto/                        # only for contracts
  entities/                   # only for persistence
```

- Controllers own HTTP metadata, validated binding, response mapping, and delegation only.
- Services own business workflows, policy, orchestration, and transaction boundaries.
- Concrete repositories own TypeORM queries, locks, and persistence operations.
- DTOs are explicit API contracts. ORM entities never leave the owning feature.
- `index.ts` exports only the module, service, and intentional public contracts.

Features consume one another through the owning module's exported service and public index. Direct
imports of another feature's repository, entity, or internal DTO are forbidden. Shared code enters
`src/common` only after at least two real consumers exist and it contains no feature policy.

Use `pnpm scaffold:feature <name> [--http] [--persistence] --dry-run`, then the repository skill.
Create optional folders and files only when the feature actually uses them. Every feature also owns
`docs/01-backend/modules/<feature>.md` based on the module documentation template.
