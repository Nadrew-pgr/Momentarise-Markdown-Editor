# Momentarise Markdown Editor

Markdown-native framework for building modern, portable, AI-ready document editors where durable documents remain real `.md` files.

This repository restarted from documentation first. The implementation is now underway, but the architecture must stay production-oriented and preservation-first.

## Repository status

Current state: implementation started.

Completed slices:

- MME-0001: TypeScript monorepo skeleton, host-independent core contracts, package entrypoints, and initial tests.
- MME-0002: CodeMirror 6 source-mode mini web demo with visual verification artifacts.

See `docs/internal/build-log.md` for the latest completed issue and current progress.

Momentarise Markdown Editor is separate from Momentarise Workbench. The framework handles Markdown documents, source/rich editing, preservation, save behavior, adapters, HTML previews, and AI writing assistance. It does not implement SaaS, Mission Control, calendar, RAG, long-running agents, subagents, or the full Momentarise harness in V0.

## Documentation layout

- `AGENT.md`: mandatory build instructions for coding agents and contributors.
- `docs/public/`: publishable documentation, starting with the glossary.
- `docs/internal/`: product, planning, quality, issue, and build-process documents. These are not part of the public docs site by default.

Read the build documents in order:

1. `AGENT.md`
2. `README.md`
3. `docs/internal/PRD.md`
4. `docs/internal/QUALITY_GATES.md`
5. `docs/internal/ISSUES.md`
6. `docs/internal/build-log.md`
7. `docs/public/GLOSSARY.md`

The public documentation boundary is deliberate: publish `README.md` and `docs/public/` by default; include `docs/internal/` only when explicitly intended.
