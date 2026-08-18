# Mail Module

## Purpose and scope

`mail` owns typed mail-job production, template rendering, sender/branding configuration, delivery
records, retry/retention policy, SMTP delivery, worker lifecycle, and correlation propagation. It
does not own auth tokens, two-step policy, or user state.

## Structure and public surface

`MailService` and `TemplateRendererService` are exported through the module index. Auth supplies an
email, display name, raw one-time token, and expiry; mail builds the public action URL and job. No
auth repository or entity is imported.

## Template standard

Named HBS bodies live under `templates/emails`. A single `layouts/base.hbs` wraps every body and
always renders shared `partials/header.hbs` and `partials/footer.hbs`. Typed configuration injects
primary/secondary colors, optional logo, company name, and support email. Handlebars escapes all
context values; only the already-rendered body occupies the layout's intentional raw slot.

Templates cover email verification, password reset, two-step codes, new sessions, forced session
revocation, password changes, two-step changes, account-status changes, role changes, and team
invitations. Every
template uses the common layout, has renderer tests, and never embeds environment-specific hosts.

## Queue and security policy

Jobs use BullMQ queue `mail`, five exponential-backoff attempts by default, one-hour completed-job
retention, and 24-hour failed-job retention. Each job carries `x-correlation-id`. Redis necessarily
contains the recipient and one-time action URL until processing; logs must never include those
fields, passwords, message bodies, SMTP credentials, or raw tokens.

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

Tests verify queue payload policy, correlation propagation, disabled behavior, action URLs, every
security template, shared header/footer rendering, escaping, worker retry/failure behavior, delivery
state, and SMTP delivery through Mailpit.

**Navigation:** [Previous: Files Module](files.md) | [Documentation Index](../../README.md) | [Next: Users Module](users.md)
