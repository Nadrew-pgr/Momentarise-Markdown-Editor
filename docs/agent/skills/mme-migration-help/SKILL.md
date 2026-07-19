---
name: mme-migration-help
description: "Use when helping migrate from Markdown textareas, Tiptap, BlockNote, MDX docs, CMS editors, or host-specific rich editors to Momentarise Markdown Editor."
---

# Mme Migration Help

Start from the current integration target.

Read public docs in this order:
- `docs/public/concepts/document-model.md`
- `docs/public/concepts/preservation.md`
- `docs/public/concepts/import-export.md`
- the matching quickstart under `docs/public/quickstart/`
- package docs under `docs/public/packages/` as needed
- `llms.txt` for the public docs index
- `llms-full.txt` when you need the complete public context

Migration boundaries:
- Markdown is source; HTML, MDX output, JSON blocks, CMS records, and editor ASTs are artifacts or adapters.
- Preserve unknown syntax and keep source fallback available.
- Do not promise production collaboration, hosted AI, or CMS persistence unless host code provides it.
