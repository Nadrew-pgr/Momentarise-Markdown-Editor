# Momentarise Markdown Editor

Markdown-native framework for building modern, portable, AI-ready document editors where durable documents remain real `.md` files.

This repository restarted from documentation first. The implementation is now underway, but the architecture must stay production-oriented and preservation-first.

## Repository status

Current state: implementation started.

Completed slices:

- MME-0001: TypeScript monorepo skeleton, host-independent core contracts, package entrypoints, and initial tests.
- MME-0002: CodeMirror 6 source-mode mini web demo with visual verification artifacts.
- MME-0003: Fixture corpus and expectations for preservation, opaque syntax, policy-sensitive placeholders, and vault-like Markdown.
- MME-0004: Pre-parser identity round-trip harness and demo status panel.
- MME-0005: Real Markdown AST parser foundation with frontmatter extraction, opaque preservation diagnostics, and demo parser status.
- MME-0006: Source-range serializer edits with opaque preservation and edited-range tests.
- MME-0007: Source editing UX baseline with list/checkbox exit, pairing, code fence editing, selection preservation, and visual QA artifacts.
- MME-0008: Host-independent Save Engine with dirty/autosave/manual flush/conflict/no-overwrite tests and truthful persistence UI.
- MME-0009: Local Markdown file open/save in the mini web demo, including File System Access support, fallback import/export, truthful disk/error states, CRLF preservation, and visual QA artifacts.
- MME-0010: CLI V0 with init, check, fixture tests, inspect, format dry-run/write, fixture creation, and machine-readable JSON output for agents.
- MME-0011: Properties UI basics in the mini web demo, code-complete with human review status tracked in the build log.
- MME-0011.5: Alignment gate before rich mode, resolving policy/source-package/parser/status drift before `MME-0012`.

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

## CLI quickstart

Build the CLI before invoking it directly from the workspace:

```sh
npm run build
node packages/md-cli/dist/index.js --help
```

Core commands:

```sh
node packages/md-cli/dist/index.js init
node packages/md-cli/dist/index.js check
node packages/md-cli/dist/index.js test:fixtures
node packages/md-cli/dist/index.js inspect fixtures/002-yaml-frontmatter/input.md
node packages/md-cli/dist/index.js format README.md
node packages/md-cli/dist/index.js format README.md --write
node packages/md-cli/dist/index.js create-fixture my-fixture
```

`mme format <file>` is dry-run by default. It writes only when `--write` is present.

Agents and scripts can add `--json` to supported commands for machine-readable output.
