# Security Policy

Do not open a public issue for a suspected vulnerability. Report it privately to the repository
security owner with affected versions, reproduction steps, impact, and any proposed mitigation.

Never commit credentials, tokens, production endpoints, private customer data, or real personal
information. Use `.env.example` only for safe local placeholders and managed secrets for deployed
environments.

Security-impacting pull requests require CODEOWNERS review and must preserve input validation,
least-privilege configuration, structured redacted logging, immutable deployment artifacts,
migration safety, and rollback behavior. High or critical production advisories block merge unless
a time-bounded exception is documented with an owner and remediation issue.
