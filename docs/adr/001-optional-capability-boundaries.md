# ADR-001: Optional Capability Boundaries

- Status: Accepted
- Date: 2026-08-29

## Context

Generated applications need repeatable capability selection without private cross-feature imports or
orphaned migrations, workers, and configuration.

## Decision

The machine-readable `capabilities.manifest.json` is the source of truth for boundaries and
dependencies, including `user-avatars` to `files`. Optional features communicate through public
module indexes and services; architecture checks reject private imports. Selective generation is
rejected until the initializer can rewrite every import, script, worker, Compose service, env rule,
and shared path needed by each supported combination and validate the resulting project.

## Consequences

The full reference profile is reproducible. Selective profiles are a planned capability, not a
current support promise. Capability removal from an initialized client application remains an
application migration and may require a data plan. Stable avatar routes and permission-override
contracts remain compatible.

## Validation

Manifest, architecture, initializer, and full-profile tests are required by CI. Selective support
requires generated-combination tests before it can be advertised.

**Navigation:** [Previous: ADR Template](000-template.md) | [Documentation Index](../README.md) | [Next: Managed Recovery ADR](002-managed-recovery-and-migration-compatibility.md)
