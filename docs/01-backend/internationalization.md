# Internationalization Standard

English is the shipped fallback language. The configured custom language header is resolved before
`Accept-Language`; unsupported values fall back safely to English. Localized error responses include
`Content-Language`.

Global translation is limited to registered error and application message keys. Business fields are
localized explicitly in their owning service/response contract. Never recursively rewrite arbitrary
fields. `pnpm i18n:check` keeps the error registry and English resource file synchronized.

Feature error keys, including identity user/role/conflict messages, live in the same English catalog
and are validated against the central registry. Stable codes do not change when a future translation
is added.

Auth keys cover invalid credentials, lockout, verification, refresh reuse, suspension, and session
lookup. Raw tokens, email addresses, and validation-field values are never interpolated into stable
localized top-level messages.
