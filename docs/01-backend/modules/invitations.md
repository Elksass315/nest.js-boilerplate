# Invitations Module

## Purpose and scope

`invitations` owns administrative team-invitation creation, inspection, resend, revocation, token
rotation, public acceptance, and invitation email orchestration for the single application
workspace. It does not edit fixed RBAC definitions, create login sessions, or introduce
tenant/workspace state.

## Structure and public surface

The flat module contains a versioned controller, workflow service, concrete TypeORM repository,
`InvitationEntity`, DTOs, and tests. It consumes `AuthorizationService` for fixed-role resolution,
`UsersService` for member existence, atomic active-account creation, role assignment, and audits;
`AuthService` for Argon2id password hashing; and `MailService` for correlated Handlebars delivery.
Other modules may import only public feature indexes.

## API contracts

| Method | Route                          | Policy                    | Success | Reachable errors                  |
| ------ | ------------------------------ | ------------------------- | ------- | --------------------------------- |
| POST   | `/team/invitations/accept`     | anonymous                 | 201     | 401, 409, 422                     |
| POST   | `/team/invitations`            | `team.invitations.create` | 201     | 401, 403, 409, 422, 503           |
| GET    | `/team/invitations`            | `team.invitations.read`   | 200     | 401, 403, 422                     |
| GET    | `/team/invitations/:id`        | `team.invitations.read`   | 200     | 400, 401, 403, 404                |
| POST   | `/team/invitations/:id/resend` | `team.invitations.resend` | 200     | 400, 401, 403, 404, 409, 410, 503 |
| DELETE | `/team/invitations/:id`        | `team.invitations.revoke` | 204     | 400, 401, 403, 404, 409           |

Creation lets admins assign `user` while super administrators may assign any fixed role. Invitation
creation and resend commit token rotation, audit metadata, and the durable `mail.send` outbox row in
one transaction. Acceptance publicly consumes a token, full name, and password, creates an active
verified account with the invited role, records its audit, and commits the acceptance notice in the
same transaction; it never creates a login session. Resend rotates the token and enforces cooldown and
maximum-send policy.

Swagger is authoritative for concrete success payloads and exact errors. Stable feature errors cover
invalid tokens, missing/expired/non-pending invitations, duplicate members or pending invitations,
resend cooldown and limit, forbidden role assignment, and mail-queue unavailability.

## Data and migrations

Migration `1787011200000` creates `team_invitations` with role/inviter/acceptor foreign keys,
lifecycle and send-count checks, lookup/expiry indexes, and a partial unique index allowing only one
pending invitation per normalized email. Raw tokens are never stored: only SHA-256 hashes persist.
Creation, resend rotation, acceptance, and revocation use explicit transactions and row locks.
Migration `1787097600000` adds a unique token-hash lookup. Acceptance locks the token, creates the
user and role assignment, appends the audit, marks the invitation accepted, and replaces the
consumed hash in one transaction.

Immutable seed `003-team-invitations-rbac` adds read/create/resend/revoke permissions to super-admin
and admin roles without changing the checksum of the already-applied base RBAC seed.

## Security and observability

Every route requires a typed permission and every role assignment is checked against inviter
authority. Tokens are generated from 32 random bytes, shown only to the mail producer, rotated on
resend and consumption, and excluded from DTOs, logs, and audits. Mail jobs and
`team.invitation.*` audit events carry
the current request/correlation context. Full email addresses appear only in authorized API
contracts and required queue payloads; structured logs remain identifier-only.

Configuration defaults to a 72-hour lifetime, five total sends, and a 60-second resend cooldown.
`TEAM_INVITATION_BASE_URL` is the public frontend acceptance URL; it must not contain a token.

## Test strategy and change impact

Unit tests cover normalization/hashing, role authority, member conflicts, cooldown, idempotent
revocation, token consumption, atomic active-user creation, controller delegation, seed additions,
configuration defaults, and shared mail rendering.
Integration validation must run the migration and seed registry against PostgreSQL before handoff.
Rollback drops invitation history, so operators must confirm retention requirements before reverting.

## Cursor pagination rationale

Not applicable. Invitation administration uses the default bounded offset pagination contract.

**Navigation:** [Previous: Files Module](files.md) | [Documentation Index](../../README.md) | [Next: Mail Module](mail.md)
