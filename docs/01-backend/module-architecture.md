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
- `index.ts` exports only the module, service, and intentional public contracts. Module indexes are
  Knip entry points so deliberate cross-feature exports remain while unused private symbols fail.

Features consume one another through the owning module's exported service and public index. Direct
imports of another feature's repository, entity, or internal DTO are forbidden. Shared code enters
the purpose-specific `core`, `common`, `shared`, or `types` boundary only with a current reusable
consumer and no feature policy. See [Shared Foundation](shared-foundation.md).

Use `pnpm scaffold:feature <name> [--http] [--persistence] --dry-run`, then the repository skill.
Both single-word names such as `users` and multi-word kebab-case names are supported.
Create optional folders and files only when the feature actually uses them. Every feature also owns
`docs/01-backend/modules/<feature>.md` based on the module documentation template.

Business collection routes follow the [pagination standard](../02-api/pagination-standard.md) and
never return raw arrays.
