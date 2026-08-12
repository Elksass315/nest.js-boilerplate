# Mail Module

## Purpose and scope

`mail` owns typed mail-job production, template rendering, sender/branding configuration, retry and
retention policy, and correlation propagation. It does not own auth token generation or SMTP worker
process lifecycle. The worker consumes the same job/template contract in the email-security slice.

## Structure and public surface

`MailService` and `TemplateRendererService` are exported through the module index. Auth supplies an
email, display name, raw one-time token, and expiry; mail builds the public action URL and job. No
auth repository or entity is imported.

## Template standard

Named HBS bodies live under `templates/emails`. A single `layouts/base.hbs` wraps every body and
always renders shared `partials/header.hbs` and `partials/footer.hbs`. Typed configuration injects
primary/secondary colors, optional logo, company name, and support email. Handlebars escapes all
context values; only the already-rendered body occupies the layout's intentional raw slot.

Current templates are `email-verification` and `reset-password`. New templates must use the common
layout, receive synthetic renderer tests, and never embed environment-specific hosts.

## Queue and security policy

Jobs use BullMQ queue `mail`, five exponential-backoff attempts by default, one-hour completed-job
retention, and 24-hour failed-job retention. Each job carries `x-correlation-id`. Redis necessarily
contains the recipient and one-time action URL until processing; logs must never include those
fields, passwords, message bodies, SMTP credentials, or raw tokens.

`MAIL_ENABLED=false` skips job production safely. SMTP connection variables are validated and owned
by mail configuration but consumed only by the separate worker. Production deployment must run that
worker before enabling mail.

## Test strategy and change impact

Tests verify queue payload policy, correlation propagation, disabled behavior, action URLs, shared
header/footer rendering, branding, and HTML escaping. The email-security branch adds SMTP/Mailpit,
worker retry, delivery logging, and integration coverage without changing auth contracts.
