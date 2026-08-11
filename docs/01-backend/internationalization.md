# Internationalization Standard

English is the shipped fallback language. The configured custom language header is resolved before
`Accept-Language`; unsupported values fall back safely to English. Localized error responses include
`Content-Language`.

Global translation is limited to registered error and application message keys. Business fields are
localized explicitly in their owning service/response contract. Never recursively rewrite arbitrary
fields. `pnpm i18n:check` keeps the error registry and English resource file synchronized.
