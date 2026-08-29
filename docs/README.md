# Documentation Index

This directory is the source of truth for architecture, API contracts, delivery, operations, and
engineering governance. Documentation is part of the implementation and changes in the same pull
request as the behavior it describes.

## Overview

- [Architecture](00-overview/architecture.md)
- [Technology stack](00-overview/tech-stack.md)

## Backend standards

- [Feature module architecture](01-backend/module-architecture.md)
- [Capability manifest and project initializer](01-backend/project-initializer.md)
- [Configuration](01-backend/configuration.md)
- [Error handling](01-backend/error-handling.md)
- [Structured logging](01-backend/logging.md)
- [Sentry](01-backend/sentry.md)
- [Observability and retention](01-backend/observability-retention.md)
- [Database and migrations](01-backend/database.md)
- [Migrations and seeds](01-backend/migrations.md)
- [Shared foundation](01-backend/shared-foundation.md)
- [Internationalization](01-backend/internationalization.md)
- [Health endpoints](01-backend/health.md)
- [Authentication and sessions](01-backend/modules/auth.md)
- [Authorization](01-backend/modules/authorization.md)
- [Users](01-backend/modules/users.md)
- [User avatars](01-backend/modules/user-avatars.md)
- [Mail](01-backend/modules/mail.md)
- [File storage](01-backend/modules/files.md)
- [Team invitations](01-backend/modules/invitations.md)
- [Feature flags](01-backend/modules/feature-flags.md)

## API standards

- [REST and versioning](02-api/rest-standard.md)
- [OpenAPI and Swagger](02-api/openapi-standard.md)
- [Error catalog](02-api/error-catalog.md)
- [Pagination](02-api/pagination-standard.md)

## Development process

- [Branching strategy](03-dev-process/branching-strategy.md)
- [Commit standard](03-dev-process/commit-standard.md)
- [Pull-request review](03-dev-process/review-process.md)
- [Upgrade and rollback guide](03-dev-process/upgrade-guide.md)

## Deployment

- [Docker workflow](04-deployment/docker.md)
- [CI/CD ownership](04-deployment/ci-cd.md)
- [v1 readiness and recovery](04-deployment/v1-readiness.md)

## Governance and templates

- [Documentation policy](governance/documentation-policy.md)
- [Architecture rules](governance/architecture-rules.md)
- [Supported capability matrix](governance/capability-matrix.md)
- [Operational ownership](governance/operational-ownership.md)
- [Template governance](governance/template-governance.md)
- [Module documentation template](templates/module-doc-template.md)
- [ADR template](adr/000-template.md)
- [ADR-001: Optional capability boundaries](adr/001-optional-capability-boundaries.md)
- [ADR-002: Managed recovery and migration compatibility](adr/002-managed-recovery-and-migration-compatibility.md)
- [ADR-003: Template release and provenance](adr/003-template-release-and-provenance.md)

**Navigation:** [Previous: Project README](../README.md) | Documentation Index | [Next: Architecture Overview](00-overview/architecture.md)
