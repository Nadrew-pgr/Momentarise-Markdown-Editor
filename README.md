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
- MME-0012: Rich mode ProseMirror spike with source/rich switching, basic rich editing, visual QA, reviewer fixes, and human acceptance.
- MME-0013: Slash menu and toolbar V0 with rich command registry/API, visual QA, reviewer fixes, and human acceptance.
- MME-0013.5: Rich editor UX input rules and block affordances with live Markdown prefix transforms, todo checkboxes, code controls, visual QA, and reviewer fixes.
- MME-0014: Hierarchical H1-H6 rich-mode section folding as sidecar/session state, with explicit toggle-block distinction, visual QA, and reviewer fixes.
- MME-0015: HTML File Reader and sandbox preview with source opening, sandboxed iframe preview, scripts disabled by default, visual QA, and reviewer status tracked in the build log.
- MME-0016: Configurable Document Access Policy V0 with hard-deny fixtures, warning/override metadata, host/user/workspace rules, and audit records.
- MME-0017: AI writing BYOK V0 with package/session/policy contracts, staged suggestions, demo entrypoint, and visual screenshots pending because local screenshot tooling is currently failing.

- MME-0018: Reference Editor Surface V0, accepted by the human as editor-surface direction with redirect (2026-06-10). All nine scripted visual artifacts are now captured. Preservation blockers were redirected into MME-0019/MME-0020.
- MME-0019: Rich-mode round-trip fidelity gate. All 18 fixtures round-trip byte-for-byte through rich mount + serialize; unsupported blocks (GFM tables, unknown constructs) are preserved as raw blocks instead of flattened paragraphs; strikethrough survives edits; opaque detection no longer false-positives on currency or fenced-code content. Visual verification scripted and captured.
- MME-0020: Targeted rich serialization and no-rewrite saves. Human accepted 2026-06-13 after preservation, save truthfulness, restored-copy wording, and folding chevron review follow-ups.
- MME-0021: Rich list and todo editing baseline, accepted by the human after caret, nesting, Backspace, checkbox keyboard, and input-rule review fixes.
- MME-0022: Source-mode keymap integrity with explicit CodeMirror extension composition, official Markdown continuation/backspace behavior, and browser-verified source keymap checks.
- MME-0023: Headless editor session and events, accepted by the human after session/API proof, stale AI suggestion guard, demo session consumption, compact AI popover review fix, and AI follow-up issue planning.
- MME-0024: Publishable package restructure, accepted by the human after peer-dependency cleanup, shared hash/NodeId tightening, model serializer split, and npm/pnpm strict consumer smoke proof.
- MME-0039: Interim demo visual refresh (human-directed, out of phase order). CSS-only restyle of the demo chrome and editing surfaces; the values are the draft defaults for the MME-0025 token set.

Current slice:

- MME-0025: Theming contracts: tokens, host theme, icon set.

Next planned slices (public framework readiness sequence, 2026-06-09):

- Phase A — integrity: MME-0021 rich list/todo editing baseline; MME-0022 source keymap integrity.
- Phase B — headless engine and packaging: MME-0023 headless editor session; MME-0024 publishable package restructure.
- Phase C — contracts: MME-0025 theming tokens/theme/icons; MME-0026 preferences, locks, capabilities; MME-0027 extension registry V0.
- Phase D — surface and bindings: MME-0028 editor surface package; MME-0029 block interaction affordances; MME-0030 beautiful default theme; MME-0031 React binding and consumer validation.
- Phase E — product surfaces: MME-0032 Markdown HTML renderer and inline-HTML policy; MME-0033 find/replace and outline APIs.
- Phase F — adapters: MME-0034 Theia adapter alpha (previously MME-0019); MME-0035 host external-change strategy (previously MME-0020).
- Phase G — publish and docs: MME-0036 release engineering and security; MME-0037 public docs content baseline; MME-0038 public docs site and AX docs surface.

See `docs/internal/build-log.md` for the latest completed issue and current progress.

Momentarise Markdown Editor is separate from Momentarise Workbench. The framework handles Markdown documents, source/rich editing, preservation, save behavior, adapters, HTML previews, and AI writing assistance. It does not implement SaaS, Mission Control, calendar, RAG, long-running agents, subagents, or the full Momentarise harness in V0.

## Documentation layout

- `AGENT.md`: mandatory build instructions for coding agents and contributors.
- `docs/public/`: publishable documentation, starting with the glossary.
- `docs/internal/`: product, planning, quality, issue, backlog, and build-process documents. These are not part of the public docs site by default.

Backlog context lives in both `docs/internal/ISSUES.md` and `docs/internal/BACKLOG.md`: `ISSUES.md` remains the executable issue queue and may contain future split candidate notes, while `BACKLOG.md` is the product-level backlog for must-have hygiene, differentiators, adapters, research, and maybe-later items.

Read the build documents in order:

1. `AGENT.md`
2. `README.md`
3. `docs/internal/PRD.md`
4. `docs/internal/QUALITY_GATES.md`
5. `docs/internal/ISSUES.md`
6. `docs/internal/BACKLOG.md`
7. `docs/internal/build-log.md`
8. `docs/public/GLOSSARY.md`

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
