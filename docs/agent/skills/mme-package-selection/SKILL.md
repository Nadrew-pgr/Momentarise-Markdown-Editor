---
name: mme-package-selection
description: "Use when selecting Momentarise Markdown Editor packages, explaining package responsibilities, or choosing APIs for vanilla, React, Next.js, CLI, renderer, save, policy, AI, and host-adapter integrations."
---

# Mme Package Selection

Choose packages by boundary, not framework habit.

Package source docs:
- `docs/public/packages/md-adapter-theia.md`
- `docs/public/packages/md-adapter-web.md`
- `docs/public/packages/md-ai.md`
- `docs/public/packages/md-cli.md`
- `docs/public/packages/md-core.md`
- `docs/public/packages/md-editor.md`
- `docs/public/packages/md-format.md`
- `docs/public/packages/md-policy.md`
- `docs/public/packages/md-preview-html.md`
- `docs/public/packages/md-react.md`
- `docs/public/packages/md-render-html.md`
- `docs/public/packages/md-rich-prosemirror.md`
- `docs/public/packages/md-save.md`
- `docs/public/packages/md-source-codemirror.md`
- `docs/public/packages/md-surface.md`
- `docs/public/packages/md-theme.md`

Use `llms.txt` for navigation and `llms-full.txt` for complete package context.

Selection rules:
- Core/model work starts with `@momentarise/md-core`, `md-format`, `md-save`, `md-policy`, and `md-ai`.
- Editor orchestration uses `@momentarise/md-editor`.
- UI surfaces use `@momentarise/md-surface`; React uses `@momentarise/md-react` as a thin binding.
- Source/rich/render/preview engines stay in their own packages.
- Host adapters provide capabilities; they must not become the durable source of truth.
