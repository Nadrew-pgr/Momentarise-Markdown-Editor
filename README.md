# Momentarise Markdown Editor

Markdown-native framework for building modern, portable, AI-ready document editors where durable documents remain real `.md` files.

This repository is intentionally restarting from documentation first. The implementation may become minimal at first, but the architecture must stay production-oriented and preservation-first.

## Repository status

Current state: docs-only bootstrap. No framework source code has been added yet.

Momentarise Markdown Editor is separate from Momentarise Workbench. The framework handles Markdown documents, source/rich editing, preservation, save behavior, adapters, HTML previews, and AI writing assistance. It does not implement SaaS, Mission Control, calendar, RAG, long-running agents, subagents, or the full Momentarise harness in V0.

## Documentation layout

- `AGENT.md`: mandatory build instructions for coding agents and contributors.
- `docs/public/`: publishable documentation, starting with the glossary.
- `docs/internal/`: product, planning, quality, issue, and build-process documents. These are not part of the public docs site by default.

Read the build documents in order:

1. `AGENT.md`
2. `docs/internal/PRD.md`
3. `docs/internal/QUALITY_GATES.md`
4. `docs/internal/ISSUES.md`
5. `docs/public/GLOSSARY.md`

The public documentation boundary is deliberate: publish `README.md` and `docs/public/` by default; include `docs/internal/` only when explicitly intended.
