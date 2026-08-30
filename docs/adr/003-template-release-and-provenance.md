# ADR-003: Template Release and Provenance

- Status: Accepted
- Date: 2026-08-29

## Context

Client projects must be traceable to a template release, while security fixes need predictable
communication and backporting.

## Decision

Use immutable `template/vMAJOR.MINOR.PATCH` tags, Conventional Commit release notes, and
`.company-template.json` provenance in every generated project. Announce critical/high fixes and
backport compatible fixes to the current and immediately previous minor release lines.

## Consequences

Owners can identify affected projects and upgrade safely. Existing projects are never silently
rewritten; a patch release or explicit migration is required.

## Validation

Release checks verify tags, changelog metadata, source markers, provenance fields, and the clean
initializer workflow.

**Navigation:** [Previous: Managed Recovery ADR](002-managed-recovery-and-migration-compatibility.md) | [Documentation Index](../README.md) | [Next: ADR Template](000-template.md)
