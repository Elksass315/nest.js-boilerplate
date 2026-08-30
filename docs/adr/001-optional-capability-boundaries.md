# ADR-001: Optional Capability Boundaries

- Status: Accepted
- Date: 2026-08-29

## Context

Generated applications need repeatable capability selection without private cross-feature imports or
orphaned migrations, workers, and configuration.

## Decision

The machine-readable `capabilities.manifest.json` is the source of truth for boundaries and
dependencies, including `user-avatars` to `files`. Optional features communicate through public
module indexes and services; architecture checks reject private imports. The initializer structurally
renders composition files and validates every dependency-valid profile, including imports, scripts,
workers, Compose services, env rules, and shared paths.

## Consequences

All 24 resolved profiles are reproducible. Capability removal from an initialized client application remains an
application migration and may require a data plan. Stable avatar routes and permission-override
contracts remain compatible.

## Validation

Manifest, architecture, initializer, and generated-combination tests are required by CI. Service-backed
checks cover minimal, files-plus-avatars, and full profiles, with scheduled sharding for all 24.

**Navigation:** [Previous: ADR Template](000-template.md) | [Documentation Index](../README.md) | [Next: Managed Recovery ADR](002-managed-recovery-and-migration-compatibility.md)
