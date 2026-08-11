# Feature Module Rules

Use `$build-nestjs-feature` and `pnpm scaffold:feature <name>` when creating a feature.

- Use a flat feature-first structure: module, controller when HTTP is needed, service, concrete
  repository when persistence is needed, DTOs, entities, and tests.
- Controllers translate transport input/output and delegate immediately to services.
- Services own business workflow and transactions. Repositories own TypeORM queries.
- Do not create domain, application, infrastructure, use-case, adapter, or mapper layers by default.
- Keep entities, repositories, and internal DTOs private. Other features import only the public
  `index.ts` and consume exported services through the owning Nest module.
- Do not place feature-specific behavior in `src/common`.
- Add a migration for every schema change and cover success, validation, authorization when
  applicable, conflict, not-found, and dependency-failure paths.
