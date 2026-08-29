# ADR-002: Managed Recovery and Migration Compatibility

- Status: Accepted
- Date: 2026-08-29

## Context

Production data services are managed outside the application image, while releases need safe schema
changes and measurable recovery objectives.

## Decision

Deploy immutable images with expand/contract migrations. Production migrations require a recorded
`BACKUP_REFERENCE`; rollback is allowed only when the previous image declares compatibility. Company
defaults are RPO 15 minutes and RTO 4 hours, measured by periodic PITR restore drills.

## Consequences

Deployment has an explicit backup and compatibility gate and may fail closed. Local Compose remains a
development/CI convenience and is not a production recovery strategy.

## Validation

Jenkins contract checks, migration compatibility tests, smoke checks, and restore-drill reports are
release evidence.

**Navigation:** [Previous: Optional Capability ADR](001-optional-capability-boundaries.md) | [Documentation Index](../README.md) | [Next: Template Provenance ADR](003-template-release-and-provenance.md)
