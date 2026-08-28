# Mail Module

## Purpose and scope

`mail` owns typed mail-job production, template rendering, sender/branding configuration, delivery
records, retry/retention policy, SMTP delivery, worker lifecycle, and correlation propagation. It
does not own auth tokens, two-step policy, or user state.

## Structure and public surface

`MailService` and `TemplateRendererService` are exported through the module index. Auth supplies an
email, display name, one-time code or password-reset token, and expiry. Mail renders registration
verification as a code with no action link; password resets and invitations retain their owned
action URLs. No auth repository or entity is imported.

## Template standard

Named HBS bodies live under `templates/emails`. A single `layouts/base.hbs` wraps every body and
always renders shared `partials/header.hbs` and `partials/footer.hbs`. Typed configuration injects
primary/secondary colors, optional logo, company name, and support email. Handlebars escapes all
context values; only the already-rendered body occupies the layout's intentional raw slot.

Templates cover OTP email verification, password reset, two-step codes, new sessions, forced session
revocation, password changes, two-step changes, account-status changes, role changes, team
invitations, and account-ready notices after invitation acceptance. Every
template uses the common layout, has renderer tests, and never embeds environment-specific hosts.

## Durable delivery and security policy

Mail-producing service methods write the `mail_deliveries` row and a versioned `mail.send` record in
the same PostgreSQL transaction. The API reports success only after that transaction commits; the
outbox relay then publishes the record to BullMQ queue `mail` using the outbox UUID as the job ID.
Repeated relay attempts therefore deduplicate at the queue boundary. The durable payload contains
the recipient and one-time code or action URL until processing; logs must never include those
fields, passwords, message bodies, SMTP credentials, raw tokens, or codes.

`MAIL_ENABLED=false` skips job production and SMTP startup safely. The separate `mail-worker`
process verifies SMTP before consuming jobs, uses configured concurrency, and closes BullMQ/SMTP
connections gracefully on SIGINT/SIGTERM. BullMQ retries errors five times with exponential backoff;
completed jobs expire after one hour and failed jobs after 24 hours.

`mail_deliveries` tracks queued, processing, sent, and terminal failure states. It stores a hashed
recipient fingerprint, masked recipient, template, safe error code, attempt count, provider,
correlation ID, and timestamps. It never stores a message body, token, code, SMTP response, or full
recipient. Worker logs contain only delivery/job/template identifiers, attempt, correlation ID, and
safe error type.

## Test strategy and change impact

Tests verify transaction rollback/commit boundaries, outbox payload policy, correlation propagation, disabled behavior, verification mail
contains a code without an action URL, remaining action URLs, every security template, shared
header/footer rendering, escaping, worker retry/failure behavior, delivery state, and SMTP delivery
through Mailpit.

**Navigation:** [Previous: Files Module](files.md) | [Documentation Index](../../README.md) | [Next: Users Module](users.md)
