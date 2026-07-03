# Contributing

Momentarise Markdown Editor is Markdown-first. Real `.md` files plus YAML frontmatter stay the durable source of truth.

## Before Changing Code

- Read `AGENT.md`, `README.md`, `docs/internal/PRD.md`, `docs/internal/QUALITY_GATES.md`, and the target issue in `docs/internal/ISSUES.md`.
- Keep package boundaries host-independent. Core packages must not depend on Theia, VS Code, React, browser globals, or demo code unless the package explicitly owns that integration.
- Use TDD for behavior changes.

## Required Gates

Run targeted tests for the package you changed, then broader gates before review:

- `npm run test:contracts`
- `npm run test:architecture`
- `npm run test:publishability`
- `npm run test:public-api`
- `npm test`

If package-manager behavior changed, also run `npm run test:consumer-matrix`.

## Security Rules

- Do not bypass document policy for AI, CLI, preview, rendering, indexing, or export.
- Do not log or persist BYOK/provider keys.
- Do not turn HTML preview or Markdown rendering into durable source.
- Do not weaken sandbox defaults without a security review.

## Public API

Public exports are audited by `tests/public-api-report.test.mjs`. If an export changes, update the approved fixture only after documenting whether the change is additive or breaking.
