# Configuration Standard

Copy `.env.example` for development. Managed environments inject secrets outside Git.

Configuration is namespaced and typed by domain: app, CORS, logging, Swagger, rate limits, i18n,
database, and Redis. Each domain owns its schema fragment, loader, contract, tests, and environment
documentation. One composed validator creates the API configuration.

Executables validate only their dependencies:

- API validates every platform domain.
- Migration commands validate database settings only.
- Seed commands validate database and seed settings.
- Future workers validate app identity, logging, Redis, and their owned settings.

Raw `process.env` access is restricted to configuration and CLI entrypoints. Application code uses
typed `ConfigService` paths such as `app.port` and `database.host`. Missing, malformed, insecure, or
contradictory values fail before dependency connections.

When configuration changes, update schema, tests, `.env.example`, Compose/CI/deployment inputs, and
this document together. Swagger modes remain `public`, `basic`, and `disabled`; managed environments
reject public access.
