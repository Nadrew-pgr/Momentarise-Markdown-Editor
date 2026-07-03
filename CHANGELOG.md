# Changelog

All notable package changes are tracked here until Changesets starts generating per-package release notes.

## 0.1.0

Initial public-readiness seed for MME-0036.

- Release engineering: added MPL-2.0 framework licensing, Apache-2.0 demo/example licensing, per-package release metadata, package READMEs, Changesets config, CI, and compatibility policy.
- Public API export audit: root exports for every publishable package are now compared against `tests/fixtures/public-api-approved.json`.
- Security pass: rich-mode URL handling strips unsafe live `href`/`src` attributes, pasted HTML strips scripts and event handlers, CLI reads obey policy hard-deny paths, and public security/contribution docs define BYOK and gate expectations.
- Breaking-change notes: no public exports were removed in MME-0036. `replaceFirstRichText` and `selectFirstRichText` remain intentional experimental automation helpers and are covered by the export audit.
