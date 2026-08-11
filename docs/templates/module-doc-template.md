# `<feature>` Module

## Purpose and scope

Describe the business capability, responsibilities, and explicit non-responsibilities.

## Structure and public surface

List the controller, service, optional concrete repository/entity, exported service/contracts, and
cross-feature dependencies. Explain why each dependency is required.

## API contracts

List each versioned route, request variants, response statuses, stable error code/message pairs, and
authorization expectations. Link to Swagger; do not duplicate examples that will become stale.

## Data and migrations

Describe owned entities, constraints, indexes, migrations, transaction boundaries, and retention.

## Security and observability

Document sensitive-data handling, validation, authorization, safe log events, and metrics.

## Test strategy and change impact

Cover unit, integration, and e2e behavior plus downstream compatibility, rollout, and rollback.
