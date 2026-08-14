# Feature Module Rules

Run `pnpm branch:write-check` before any write. Use `$build-nestjs-feature` and
`pnpm scaffold:feature <name>` when creating or changing a feature.

- Use a flat feature-first structure: module, controller when HTTP is needed, service, concrete
  repository when persistence is needed, DTOs, entities, and tests.
- Controllers translate transport input/output and delegate immediately to services.
- Services own business workflow and transactions. Repositories own TypeORM queries.
- Do not create domain, application, infrastructure, use-case, adapter, or mapper layers by default.
- Keep entities, repositories, and internal DTOs private. Other features import only the public
  `index.ts` and consume exported services through the owning Nest module.
- Do not place feature-specific behavior in `src/common`.
- Use `AppBaseEntity` for normal entities and `SoftDeleteEntity` only with documented retention and
  restore behavior.
- Collection routes return the canonical offset page by default. Cursor pages require evidence in
  module documentation. Raw array responses are forbidden.
- Declare every controller as `@Controller({ path, version: API_VERSION })`. Do not hide API
  versions only in a global prefix.
- Document every route with `@ApiOperation` summary and description. Add concrete, realistic
  request/response examples for every applicable status, including each distinct accepted body and
  each stable error code/message pair. Keep Swagger and `docs/01-backend/modules/<feature>.md` in
  sync with the implementation.
- Add a migration for every schema change and cover success, validation, authorization when
  applicable, conflict, not-found, and dependency-failure paths.
- Register stable errors centrally, add English translations, and propagate request/correlation IDs
  through logs, jobs, audits, and outbound calls.
- Upload routes stay in the consuming feature, require authentication for POST/HEAD/PATCH/DELETE,
  and delegate byte transfer to the public `FilesService`. Never import storage providers, tus
  stores, storage entities, or the AWS SDK across the files-module boundary. Use a fixed purpose,
  private visibility by default, and server-generated keys.
- Image consumers reject MIME/extension/decoded-format mismatches, animation, excessive dimensions
  and decoded pixels, then re-encode in an allowed format without metadata before attachment.
