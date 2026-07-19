---
name: mme-docs
description: "Use when answering questions about Momentarise Markdown Editor docs, public Markdown source, llms files, docs-site behavior, or framework capabilities from public documentation."
---

# Mme Docs

Use public source first.

Read these repo files before answering or implementing from docs:
- `docs/public/index.md`
- `docs/public/concepts/document-model.md`
- `docs/public/concepts/agentic-experience.md`
- `llms.txt` for the short public index
- `llms-full.txt` for the full public context bundle

Rules:
- Treat Markdown plus YAML frontmatter as the durable source.
- Do not claim JSON or block database persistence.
- Do not use internal repo docs as public evidence.
- Separate shipped behavior from roadmap behavior.
- Cite `docs/public/...` paths when giving repo-grounded answers.
