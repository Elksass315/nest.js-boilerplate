# Invitations Module

## Purpose and scope

`invitations` owns administrative team-invitation creation, inspection, resend, revocation, token
rotation, and invitation email orchestration for the single application workspace. It does not yet
accept invitations, create users, edit fixed RBAC definitions, or introduce tenant/workspace state;
acceptance is delivered in the next sequential feature branch.

## Structure and public surface

The flat module contains a versioned controller, workflow service, concrete TypeORM repository,
`InvitationEntity`, DTOs, and tests. It consumes `AuthorizationService` for fixed-role resolution,
`UsersService` for member existence and append-only security audits, and `MailService` for correlated
Handlebars delivery. Other modules may import only the exported module/service index.

## API contracts

- `POST /api/v1/team/invitations` creates a pending invitation. Admins may assign `user`;
  super administrators may assign any fixed role.
- `GET /api/v1/team/invitations?page=1&limit=20` returns the canonical offset page.
- `GET /api/v1/team/invitations/:id` returns one safe contract without a token hash.
- `POST /api/v1/team/invitations/:id/resend` rotates the token, extends expiry, and enforces cooldown
  and maximum-send policy.
- `DELETE /api/v1/team/invitations/:id` idempotently revokes a pending invitation.

Swagger is authoritative for concrete success payloads and exact errors. Stable feature errors cover
missing/expired/non-pending invitations, duplicate members or pending invitations, resend cooldown
and limit, forbidden role assignment, and mail-queue unavailability.

## Data and migrations

Migration `1787011200000` creates `team_invitations` with role/inviter/acceptor foreign keys,
lifecycle and send-count checks, lookup/expiry indexes, and a partial unique index allowing only one
pending invitation per normalized email. Raw tokens are never stored: only SHA-256 hashes persist.
Creation, resend rotation, expiry transition, and revocation use explicit transactions and row locks.

Immutable seed `003-team-invitations-rbac` adds read/create/resend/revoke permissions to super-admin
and admin roles without changing the checksum of the already-applied base RBAC seed.

## Security and observability

Every route requires a typed permission and every role assignment is checked against inviter
authority. Tokens are generated from 32 random bytes, shown only to the mail producer, rotated on
resend, and excluded from DTOs, logs, and audits. Mail jobs and `team.invitation.*` audit events carry
the current request/correlation context. Full email addresses appear only in authorized API
contracts and required queue payloads; structured logs remain identifier-only.

Configuration defaults to a 72-hour lifetime, five total sends, and a 60-second resend cooldown.
`TEAM_INVITATION_BASE_URL` is the public frontend acceptance URL; it must not contain a token.

## Test strategy and change impact

Unit tests cover normalization/hashing, role authority, member conflicts, cooldown, idempotent
revocation, controller delegation, seed additions, configuration defaults, and shared mail rendering.
Integration validation must run the migration and seed registry against PostgreSQL before handoff.
Rollback drops invitation history, so operators must confirm retention requirements before reverting.

## Cursor pagination rationale

Not applicable. Invitation administration uses the default bounded offset pagination contract.

**Navigation:** [Previous: Files Module](files.md) | [Documentation Index](../../README.md) | [Next: Mail Module](mail.md)
