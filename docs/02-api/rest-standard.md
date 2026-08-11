# REST and Versioning Standard

- Use plural resource nouns and kebab-case paths; avoid verbs unless modeling a non-CRUD action.
- Business controllers declare `@Controller({ path, version: API_VERSION })` explicitly.
- Business URLs use `/api/v1/<resource>`. API versions are source-controlled, not selected by env.
- Operational controllers declare `VERSION_NEUTRAL` and are explicitly excluded from `/api`.
- Validate path, query, header, and body input at the DTO boundary; reject unknown fields.
- Whitelist filters and sort fields. Bound pagination and expensive operations.
- Never return TypeORM entities as API contracts.

Backward-incompatible behavior requires a version strategy, migration guidance, tests,
documentation, and release communication. A controller without explicit version metadata fails
`pnpm arch:check`.
