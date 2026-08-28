# Template Release and Provenance Governance

## Releases

Template releases use immutable Git tags named `template/vMAJOR.MINOR.PATCH` and follow Semantic
Versioning. Breaking generator, configuration, or public-contract changes increment MAJOR; additive
capabilities and compatible behavior increment MINOR; fixes and dependency/security updates
increment PATCH. Conventional Commits drive release notes through semantic-release. A release must
include validation evidence, the supported capability matrix, and known limitations.

Generated projects record provenance in `.company-template.json`, including the source template
version, selected capabilities, initialization time, and compatibility metadata. The untouched
`.company-template-source.json` marker prevents accidental re-initialization or partial overwrite.
Generated projects should retain the provenance file when customizing the application.

## Security fixes and backports

Critical and high-severity template fixes are announced to owners through the company security
channel and release notes, with migration and upgrade instructions. Fixes are backported to the
current release line and the immediately previous minor line when technically compatible. A fix
must never silently rewrite an existing generated project; owners receive a patch release or an
explicit migration. The announcement identifies affected capability profiles, minimum safe tag,
validation evidence, and any required managed-service action.

**Navigation:** [Previous: Operational Ownership](operational-ownership.md) | [Documentation Index](../README.md) | [Next: Documentation Policy](documentation-policy.md)
