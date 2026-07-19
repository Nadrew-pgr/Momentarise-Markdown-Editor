---
name: mme-docs-to-implementation
description: "Use when turning Momentarise Markdown Editor public docs into implementation prompts, coding-agent instructions, checklists, or local proof commands."
---

# Mme Docs To Implementation

Build prompts from source docs, not screenshots.

Read:
- `docs/public/concepts/agentic-experience.md`
- `docs/public/packages/md-cli.md`
- `docs/public/concepts/preservation.md`
- `docs/public/concepts/save-truthfulness.md`
- `llms.txt` and `llms-full.txt`

Prompt rules:
- Include the relevant `docs/public/...` path.
- Preserve Markdown-as-source and no-full-document-rewrite constraints.
- Require real tests or CLI proof, usually `npm run build`, `npm run test:docs`, `npm run test:llms-sync`, or `node packages/md-cli/dist/index.js check --json`.
- Mark public-roadmap features as future unless current package docs prove otherwise.
