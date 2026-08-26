# Internationalization Standard

English is the shipped fallback language. The configured custom language header is resolved before
`Accept-Language`; unsupported values fall back safely to English. Localized error responses include
`Content-Language`.

Global translation is limited to registered error and application message keys. Business fields are
localized explicitly in their owning service/response contract. Never recursively rewrite arbitrary
fields. `pnpm i18n:check` keeps the error registry and English resource file synchronized. The
registered `INTERNAL_SERVER_ERROR` translation is always the generic `Internal server error`; it
must not expose exception details or vary by failure cause.

Feature error keys, including identity user/role/conflict messages, live in the same English catalog
and are validated against the central registry. Stable codes do not change when a future translation
is added.

Auth keys cover invalid credentials, lockout, registration-code expiry/attempt exhaustion, refresh
reuse, suspension, and session lookup. Raw tokens, OTPs, email addresses, registration identifiers,
and validation-field values are never interpolated into stable localized top-level messages.

Email two-step keys cover invalid challenges, email codes, recovery codes, bounded-attempt failures,
and enabled-state conflicts, including the mandatory administrator-role policy. These translations remain generic: challenge tokens, codes, recipient
addresses, attempt values, and account state are never interpolated into the localized message.

File keys cover missing/hidden files, upload expiry, incomplete state, purpose size/type/image
validation, and storage outages. They never interpolate original filenames, object keys, paths,
buckets, uploader identity, or provider diagnostics. tus protocol headers remain language-neutral;
client-visible JSON error messages use the same registered English fallbacks as the global filter.

Invitation keys cover lookup, expiry, lifecycle conflicts, duplicate members/pending invitations,
resend policy, role authority, and delivery availability. Messages remain generic and never
interpolate invitation tokens, email addresses, provider diagnostics, or configured limits.
The invalid-token translation is intentionally generic and does not distinguish an unknown token
from one rotated by resend or successful acceptance.

Feature-flag translations cover missing keys, duplicate definitions, and optimistic concurrency
conflicts. Flag keys, descriptions, actor identifiers, and audit context are never interpolated into
the stable localized message.

Permission override errors remain generic and never interpolate user IDs or permission keys.

**Navigation:** [Previous: Health Endpoints](health.md) | [Documentation Index](../README.md) | [Next: Structured Logging](logging.md)
