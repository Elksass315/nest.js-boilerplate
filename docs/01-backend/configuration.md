# Configuration Standard

Copy `.env.example` for local development. Managed environments inject values through their secret
mechanism; no staging or production secrets belong in Git.

The application validates all keys before connecting to dependencies. Missing, malformed,
insecure, contradictory, and unknown application values are rejected or stripped by the canonical
schema in `src/config/environment.ts`.

When adding or changing configuration, update in the same pull request:

1. `EnvironmentVariables` and Joi validation.
2. Validation tests, including invalid and contradictory combinations.
3. `.env.example` comments and safe local values.
4. This document plus Compose, GitHub Actions, Jenkins, and deployment secrets when applicable.

Public API versions are source-controlled contracts, not environment configuration. Port, app
identity, CORS, logging, Swagger access, database, Redis, and rate-limit settings use one naming
scheme shown in `.env.example`.

Swagger access modes are `public`, `basic`, and `disabled`. Staging and production reject `public`.
`basic` requires a username of at least three characters and a password of at least sixteen;
credentials are rejected in the other modes to prevent false assumptions about protection.
