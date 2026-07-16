# @momentarise/docs-site

Static public documentation site for Momentarise Markdown Editor.

The site reads `docs/public/**/*.md` as the durable source, renders the content with `@momentarise/md-render-html`, and exposes raw Markdown plus agent-friendly page actions.

## Release metadata

- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: Apache-2.0
- Public API: app package only; framework package exports are audited by `npm run test:public-api`.
