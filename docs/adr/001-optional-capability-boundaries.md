# ADR-001: Optional Capability Boundaries

- Status: Accepted
- Date: 2026-08-29

## Context

Generated applications need repeatable capability selection without private cross-feature imports or
orphaned migrations, workers, and configuration.

## Decision

The machine-readable `capabilities.manifest.json` is the source of truth. The initializer resolves
dependencies (including `user-avatars` to `files`) and removes unselected assets. Optional features
communicate through public module indexes and services; architecture checks reject private imports.

## Consequences

Profiles are reproducible and generator-ready. Capability removal is explicit and may require a data
plan. Stable avatar routes and permission-override contracts remain compatible.

## Validation

Manifest, architecture, initializer, and generated-combination tests are required by CI.

**Navigation:** [Previous: ADR Template](000-template.md) | [Documentation Index](../README.md) | [Next: Managed Recovery ADR](002-managed-recovery-and-migration-compatibility.md)
