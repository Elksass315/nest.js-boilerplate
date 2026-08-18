# Documentation Index

This directory is the source of truth for architecture, API contracts, delivery, operations, and
engineering governance. Documentation is part of the implementation and changes in the same pull
request as the behavior it describes.

## Overview

- [Architecture](00-overview/architecture.md)
- [Technology stack](00-overview/tech-stack.md)

## Backend standards

- [Feature module architecture](01-backend/module-architecture.md)
- [Configuration](01-backend/configuration.md)
- [Error handling](01-backend/error-handling.md)
- [Structured logging](01-backend/logging.md)
- [Database and migrations](01-backend/database.md)
- [Migrations and seeds](01-backend/migrations.md)
- [Shared foundation](01-backend/shared-foundation.md)
- [Internationalization](01-backend/internationalization.md)
- [Health endpoints](01-backend/health.md)
- [File storage](01-backend/modules/files.md)
- [Team invitations](01-backend/modules/invitations.md)
- Feature module records live under `01-backend/modules/` when business modules are added.

## API standards

- [REST and versioning](02-api/rest-standard.md)
- [OpenAPI and Swagger](02-api/openapi-standard.md)
- [Error catalog](02-api/error-catalog.md)
- [Pagination](02-api/pagination-standard.md)

## Development process

- [Branching strategy](03-dev-process/branching-strategy.md)
- [Commit standard](03-dev-process/commit-standard.md)
- [Pull-request review](03-dev-process/review-process.md)

## Deployment

- [Docker workflow](04-deployment/docker.md)
- [CI/CD ownership](04-deployment/ci-cd.md)

## Governance and templates

- [Documentation policy](governance/documentation-policy.md)
- [Architecture rules](governance/architecture-rules.md)
- [Module documentation template](templates/module-doc-template.md)
- [ADR template](adr/000-template.md)

**Navigation:** [Previous: Project README](../README.md) | Documentation Index | [Next: Architecture Overview](00-overview/architecture.md)

**Navigation:** [Previous: Project README](../README.md) | Documentation Index | [Next: Architecture Overview](00-overview/architecture.md)
