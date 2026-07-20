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
- MME-0025: Theming contracts, accepted by the human after DOM-free theme/token/icon contracts, tokenized demo migration, CodeMirror theme migration, default toolbar icon rendering, dark/light visual proof, and host override visual proof.
- MME-0026: Preferences, locks, and capability contracts with headless resolver tests, CodeMirror/ProseMirror live reconfiguration, demo host-preference simulation, and visual proof.
- MME-0027: Extension registry V0, accepted by the human after public registry contracts, host slash/toolbar/custom-block/AI registrations, compact toolbar review fixes, rich code-block escape fixes, slash query consumption fixes, and visual proof.
- MME-0028: Editor surface package with i18n and accessibility, accepted for code continuation after subagent review fixes; detailed UX interaction feedback deferred to later follow-ups.
- MME-0028.5: Inline AI prompt surface and usable writing flow, accepted for code continuation after UX and security subagent review fixes, keyboard/visual proof, explicit mock/missing/provider-policy states, and staged accept/reject flow.
- MME-0028.6: Real AI provider adapter path, accepted for code continuation after security and architecture subagent review fixes; adds an OpenAI-compatible/LiteLLM host-provider path, memory-only personal BYOK, endpoint/key redaction, policy-before-provider proof, and visual provider-state proof.
- MME-0029: Block interaction affordances, accepted for code continuation after UX and test subagent review fixes; adds rich block handles/menu, insert-after, state-level drag/drop reorder with raw-byte preservation, contextual selection bubble toolbar, and empty-placeholder proof.
- MME-0030: Beautiful default theme V1, accepted for continuation after default dark/light token polish, contrast proof, responsive visual artifacts, icon-first command surfaces, and reviewer fixes; broader UX refinements remain expected in later slices.
- MME-0031: React binding and external consumer validation, accepted for code continuation after adding `@momentarise/md-react`, Next App Router guidance, packed npm/pnpm consumer matrix proof, offline skip mode, and reviewer fixes.
- MME-0032: Markdown HTML renderer and inline-HTML policy, accepted for code continuation after regenerated visual proof and unsafe-image fallback fix.
- MME-0033: Find/replace and outline APIs, accepted for code continuation after source/rich find and replace proof, outline API tests, visual checks, and reviewer fixes.
- MME-0039: Interim demo visual refresh (human-directed, out of phase order). CSS-only restyle of the demo chrome and editing surfaces; the values are the draft defaults for the MME-0025 token set.
- MME-0034: Theia adapter alpha, accepted for code continuation after adapter package, Theia demo shell, OpenHandler/source/find proof, and reviewer fixes.
- MME-0035: Host adapter external-change strategy, accepted for code continuation after web focus-refresh watcher, clean external apply, dirty conflict/no-overwrite actions, autosave status fix, visual proof, and reviewer fixes.
- MME-0036: Release engineering and security pass, accepted for code continuation after license decision, package/readme/version metadata, Changesets/CI, public API audit, rich URL/paste hardening, CLI policy hardening, security docs, consumer matrix proof, and reviewer fixes.
- MME-0037: Public docs content baseline, accepted for continuation after relative-link convention approval, public `.md` docs set, package docs, docs lint, formatter identity proof, full test pass, and DX reviewer acceptance.
- MME-0040: Tables preservation and rendering, accepted for code continuation after GFM table variant fixtures, malformed table-like opaque detection, semantic safe table rendering, rich preserved-table fallback, visual proof, and reviewer fixes.
- MME-0041: Footnotes and endnotes, accepted for code continuation after GFM footnote fixtures, parser diagnostics for missing/duplicate/malformed syntax, same-paragraph rich reference preservation, stable safe render anchors/backlinks, preserved-definition fallback, visual proof, and reviewer fixes.
- MME-0042: Core editor interaction hardening, accepted for code continuation after source/rich interaction coverage, rich final-block insertion helpers, keyboard/mouse document-end proof after framed blocks, and reviewer fixes.
- MME-0043: Live Preview parity foundation, accepted for code continuation after Source/Rich/Live Preview mode contracts, live typed Markdown construct proof, save/external-change preservation proof, HTML artifact mode isolation, visual comparison, and reviewer fixes.
- MME-0044: Unified Open, New File, Save As, and status chrome, accepted for code continuation after save-picker APIs, truthful fallback/export states, explicit conflict actions, reviewer fixes, and visual proof; final human workflow review is queued for end-of-run review.
- MME-0045: Toolbar, slash, and mode controls final UX, accepted for code continuation after reusable surface command grouping, active/disabled toolbar state, fuzzy slash search, mode-control variants, mobile/constrained visual proof, and reviewer fixes; final human command-surface review is queued for end-of-run review.
- MME-0046: HTML preview reading polish, accepted for code continuation after removing the permanent technical preview strip, adding discreet sandbox/save details, proving scripts remain disabled, and capturing desktop/constrained visual proof; final human HTML-preview product review is queued for end-of-run review.
- MME-0047: Folding and document structure polish, accepted for code continuation after generic fold APIs, source-safe code/callout/opaque folding, quieter gutter controls, contextual ARIA labels, visual proof, and reviewer fixes; final human folding product review is queued for end-of-run review.
- MME-0048: Public docs launch hardening and MME-0038 validation debt, accepted for code continuation after launch-critical API/AX assertions, package docs hardening, expanded docs visual proof, reviewer pass, and full test pass; final public-face validation remains queued for end-of-run review.
- MME-0049: AX skills, manifests, and reusable agent actions, accepted for code continuation after generated repo-owned agent artifacts, reusable action descriptors, docs-site descriptor consumption, public-boundary tests, visual proof, reviewer pass, and full test pass; final AX artifact distribution review is queued for end-of-run review.
- MME-0050: Performance budgets and large-document benchmarks, accepted for code continuation after a generated 10k-line fixture, committed performance budgets, JSON benchmark output, large-document preservation/save truth proof, reviewer pass, and full test pass; final budget-threshold review is queued for end-of-run review.
- MME-0051: Asset upload provider contract and image paste/drop preservation, accepted for code continuation after adding a host-owned provider contract, policy-gated image insertion, source/rich/headless preservation tests, reviewer pass, and full test pass; final upload UX/storage-provider review is queued for end-of-run review.
- MME-0052: Plain text and lightweight source file support, accepted for code continuation after adding a reusable document-kind classifier, source-only mode routing, web adapter save/import preservation, unsupported-file guardrails, docs updates, reviewer pass, and full test pass; final lightweight source UX review is queued for end-of-run review.
- MME-0053: SVG source reader and sanitized preview, accepted for code continuation after adding standalone SVG artifact classification, Source/Preview-only routing, DOM-based allowlist sanitization, web/demo save-truth preservation, hostile-SVG tests, runtime visual proof, reviewer pass, and full test pass; final SVG artifact preview UX review is queued for end-of-run review.
- MME-0054: Visible asset upload UX and demo provider, accepted for code continuation after adding toolbar/slash/paste/drop insertion, localized upload state, exact source/rich placement, stale-upload rejection, truthful failure states, runtime browser proof, reviewer pass, and full test pass; final upload product/wording review is queued for end-of-run review.
- MME-0055: Rich GFM table editing baseline, accepted for code continuation after editable top-level tables, targeted Markdown serialization, reusable cell movement, truthful undo/redo/save behavior, real keyboard and constrained-width browser proof, reviewer pass, and full test pass; final table product/taste review is queued for end-of-run review.
- MME-0056: Rich GFM footnote definition editing baseline, accepted for code continuation after semantic references, editable safe definitions, exact targeted serialization, conservative complex/duplicate fallback, truthful undo/redo/save behavior, browser proof, reviewer pass, and full test pass; final footnote UX/AX review is queued for end-of-run review.
- MME-0057: Rich GFM footnote insertion baseline, accepted for code continuation after collision-safe reference-plus-definition insertion, exact bounded Markdown materialization, same-paragraph multiple insertion, escaped-source mapping, truthful command diagnostics/history/save behavior, browser proof, reviewer pass, and full test pass; final insertion UX/product review is queued for end-of-run review.

Current slice:

- MME-0038 remains code-complete with explicit public-face validation debt; it is committed as pending-status, not accepted as final public validation.
- No executable normal issue remains after MME-0057; autonomous continuation must promote the next must-have backlog item before implementation.

Next planned slices (public framework readiness sequence, 2026-06-09):

- Phase A — integrity: MME-0021 rich list/todo editing baseline; MME-0022 source keymap integrity.
- Phase B — headless engine and packaging: MME-0023 headless editor session; MME-0024 publishable package restructure.
- Phase C — contracts: MME-0025 theming tokens/theme/icons; MME-0026 preferences, locks, capabilities; MME-0027 extension registry V0.
- Phase D — surface and bindings: MME-0028 editor surface package; MME-0029 block interaction affordances; MME-0030 beautiful default theme; MME-0031 React binding and consumer validation.
- Phase E — product surfaces: MME-0032 Markdown HTML renderer and inline-HTML policy; MME-0033 find/replace and outline APIs.
- Phase F — adapters: MME-0034 Theia adapter alpha (previously MME-0019); MME-0035 host external-change strategy (previously MME-0020).
- Phase G — publish and docs: MME-0036 release engineering and security; MME-0037 public docs content baseline; MME-0038 public docs site and AX docs surface.
- Phase H — public editor readiness hardening: MME-0040 tables; MME-0041 footnotes/endnotes; MME-0042 core editor interactions; MME-0043 Live Preview foundation; MME-0044 unified open/new/save/status; MME-0045 command and mode UX; MME-0046 HTML preview reading polish; MME-0047 folding polish; MME-0048 docs launch hardening; MME-0049 AX skills/manifests/actions; MME-0050 performance budgets; MME-0051 asset upload contract.
- Phase I — lightweight and visual source formats: MME-0052 plain text and source-like file support; MME-0053 SVG source reader and sanitized preview.
- Phase J — media workflow UX: MME-0054 visible asset upload UX and demo provider.
- Phase K — rich Markdown structures: MME-0055 rich GFM table editing baseline; MME-0056 rich GFM footnote definition editing baseline; MME-0057 rich GFM footnote insertion baseline.

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
