# Health Endpoints

- `GET /health/live` proves the Node process can serve requests. It does not contact dependencies.
- `GET /health/ready` checks PostgreSQL, Redis, and every enabled file read provider and returns 503
  with `SERVICE_NOT_READY` when one is unavailable.

Health controllers use `VERSION_NEUTRAL` and remain outside `/api`. Responses include correlation
and security headers. Readiness failures expose only up/down state, never connection details.

Both routes have concrete Swagger examples for success. Readiness documents separate PostgreSQL,
Redis, and storage failure examples with the exact error code and client-visible message.

**Navigation:** [Previous: Error Handling](error-handling.md) | [Documentation Index](../README.md) | [Next: Internationalization Standard](internationalization.md)
