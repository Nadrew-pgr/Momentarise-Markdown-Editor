# Momentarise Markdown Editor — V0 Issues, Restart Zero

## Principle

Issues must be vertical where possible, but never at the cost of Markdown preservation.

Visible progress is valuable. Fake progress is forbidden.

Each issue must include tests, manual verification when UI/files are involved, reviewer pass, and build log update in `docs/internal/build-log.md`.

The canonical build log path is `docs/internal/build-log.md`. Do not create or update a second build log elsewhere.

Every issue must report visual impact, including editing-surface changes, general UI/inspector changes, or `No visible editing or general UI changes` for internal-only work.

For UI issues, visual verification is mandatory: dev server command, local URL, browser/host preview, manual scenario, screenshot or visual artifact under `docs/internal/visual-checks/<issue-id>/`, reviewer/subagent inspection when available, and explicit human-review status.

Default execution model for every issue:

- Implementation: sequential only.
- Fresh context rebuild required: yes, including when the human explicitly continues the same conversation.
- Reviewer subagents: allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: issue-specific.

## MME-0000 — Repository bootstrap and documentation acceptance

### Goal

Create the repo with docs only and prove that the agent has read the instructions.

### Acceptance criteria

- `README.md` and `AGENT.md` exist at the repository root.
- `docs/internal/PRD.md`, `docs/internal/QUALITY_GATES.md`, and `docs/internal/ISSUES.md` exist.
- `docs/public/GLOSSARY.md` exists.
- `docs/internal/build-log.md` exists.
- Agent outputs a summary of V0 scope, non-goals, first issue, gates, and reviewer plan.
- No source code yet.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer or fallback self-check allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no.

### Reviewer

Architecture Reviewer or fallback self-check.

## MME-0001 — Repo skeleton and core contracts

### Goal

Create monorepo skeleton and host-independent core contracts.

### Scope

Create packages:

- `@momentarise/md-core`
- `@momentarise/md-format`
- `@momentarise/md-adapter-web`
- `@momentarise/md-cli`

Define types for documents, paths, dialects, nodes, opaque nodes, source ranges, snapshots, revisions, hashes, parse/serialize results, round-trip results, editor modes, save states, policies, sidecar state.

### Acceptance criteria

- Packages compile.
- Public entrypoints export types.
- Core imports no host/editor UI libraries.
- `OpaqueNode` can store unknown source text and source range.
- `DocumentSnapshot` includes content, hash, path, dialect, optional frontmatter.
- `PolicyCapability` includes exists, metadata, read, index, write, execute, share, export.
- Build log updated.

### Out of scope

Parser, serializer, UI, CodeMirror, Theia, AI.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless package boundaries or dependency choices change architecture.

### Reviewer

Architecture Reviewer.

## MME-0002 — Source-first mini web demo with CodeMirror

### Goal

Show the first visible surface immediately: a mini web demo with CodeMirror 6 editing Markdown.

### Scope

Create a demo app that:

- renders CodeMirror 6;
- loads a built-in Markdown fixture;
- shows document name/path;
- tracks dirty/clean in memory;
- captures `Cmd/Ctrl+S`;
- supports copy/download current Markdown;
- does not depend on Theia, VS Code, ProseMirror, or AI.

### Acceptance criteria

- Demo runs with one command.
- Dev server starts with one documented command.
- Local URL is documented.
- User can edit Markdown in CodeMirror.
- `Cmd/Ctrl+S` is detected.
- `Cmd/Ctrl+Z` works.
- Redo works with `Cmd/Ctrl+Shift+Z` or platform equivalent.
- Newlines work.
- Normal multiline editing works.
- Selection works.
- Copy/paste works.
- Dirty state updates after edits.
- List continuation works or is documented as a failed acceptance criterion.
- Source editor is CodeMirror 6, not a textarea.
- CodeMirror is configured with a serious baseline extension setup, not a bare editor shell.
- Auto-closing pairs for `{}`, `[]`, `()`, quotes, and backticks work if enabled.
- Missing auto-closing pair behavior is explicitly documented as a follow-up before source mode can be considered production-grade.
- Download/copy returns current Markdown.
- No Theia import.
- Screenshots are captured for initial demo loaded, editor after typing Markdown, dirty state after edit, and `Cmd/Ctrl+S` event/log after save shortcut.
- Screenshots are stored in `docs/internal/visual-checks/MME-0002/`.
- Build log links those screenshots.
- Reviewer checks screenshots or live UI.
- Human review is requested before considering the first UI slice accepted.

### Manual verification

Start the dev server, open the documented local URL, capture the initial loaded demo, type headings/lists/code, test newline, selection, copy/paste, undo/redo, test `Cmd/Ctrl+S`, verify dirty state, capture the required screenshots, download/copy, and verify output.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and DX Reviewer allowed.
- Parallel implementation: forbidden.
- Human review required: yes, because this is the first visible UI slice.

### Reviewer

UX Reviewer.

## MME-0003 — Fixture corpus and expectations

### Goal

Create test fixtures before parser/serializer work.

### Scope

Create at least 18 fixtures:

1. simple Markdown;
2. YAML frontmatter;
3. GFM task list;
4. GFM table;
5. code fence with language;
6. blockquote;
7. Obsidian-style callout;
8. wikilink;
9. Markdown link/image;
10. HTML inline/block;
11. Mermaid fenced block;
12. LaTeX inline/block;
13. unknown custom syntax;
14. mixed real-world document;
15. sanitized vault sample;
16. policy-sensitive file;
17. long heading document for folding;
18. nested lists/todos.

Each fixture has `input.md` and `expectations.md`.

### Acceptance criteria

- No secrets/private data.
- Each expectation describes what must be preserved, normalized, opaque, source-only, or rendered.
- Fixtures documented in `fixtures/README.md`.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless fixture provenance is unclear.

### Reviewer

Test Reviewer.

## MME-0004 — Round-trip harness and demo status

### Goal

Create parse → model → serialize test harness and expose status in demo.

### Scope

Implement test command to load fixtures, parse, serialize, compare, and report diffs.

Modes:

- strict;
- semantic;
- opaque preservation.

Demo shows current fixture, parser status, serializer status, diagnostics.

### Acceptance criteria

- `test:roundtrip` command exists.
- At least 10 fixtures pass in expected mode.
- Failures show readable diffs.
- Unknown syntax fixture proves opaque preservation.
- Frontmatter fixture proves frontmatter survives.
- HTML fixture proves HTML survives if untouched.
- Demo shows pass/fail status.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Test Reviewer and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless visible demo status changes are not visually verified.

### Reviewer

Test Reviewer.

## MME-0005 — Real Markdown AST parser foundation

### Goal

Implement parser using a real Markdown AST foundation.

### Scope

Use micromark, remark/unified/mdast, or documented equivalent.

Map third-party AST to Momentarise internal model. Do not expose third-party AST types from public core.

Handle frontmatter, V0 nodes, opaque nodes, source ranges where feasible, diagnostics.

### Acceptance criteria

- No long-term handwritten parser.
- Parser handles all fixtures without throwing.
- YAML frontmatter extracted.
- Unsupported syntax becomes opaque/raw, not dropped.
- Diagnostics recorded.
- Parser result independent of ProseMirror/CodeMirror.
- Demo displays frontmatter/diagnostics.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes if the parser dependency choice changes architecture.

### Reviewer

Architecture Reviewer and Test Reviewer.

## MME-0006 — Serializer with opaque preservation and edited-range tests

### Goal

Serialize Momentarise model back to Markdown with preservation.

### Scope

Implement serializer for known V0 nodes and opaque nodes.

Add tests for edited-range behavior:

- edit heading;
- edit paragraph;
- edit list item;
- edit code fence content;
- edit code fence language;
- preserve unrelated ranges.

### Acceptance criteria

- Fixtures pass expected modes.
- Unknown syntax preserved.
- Frontmatter preserved.
- Code fences preserved.
- Tables preserved even source-only.
- HTML preserved even source-only.
- Edited one-node tests preserve unrelated file regions as closely as feasible.
- Serializer reports diagnostics/normalizations.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless preservation cannot be honestly proven.

### Reviewer

Test Reviewer.

## MME-0007 — Source editing UX baseline

### Goal

Make source mode feel like a real editor, not a demo.

### Scope

Enable/configure CodeMirror behavior:

- undo/redo;
- `Cmd/Ctrl+Z`;
- redo shortcut;
- auto-closing pairs where appropriate;
- quotes/backticks behavior;
- list continuation;
- checkbox continuation;
- indentation;
- markdown-friendly keyboard handling;
- selection/cursor preservation across non-destructive UI updates.

### Acceptance criteria

- Manual QA proves undo/redo works.
- Bracket/quote/backtick behavior works or is explicitly documented with reason.
- Enter inside list continues list.
- Enter inside checkbox continues checkbox.
- Code fence editing is comfortable in source mode.
- No regression in round-trip tests.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the source editing baseline gate.

### Reviewer

UX Reviewer.

## MME-0008 — Save Engine and truthful persistence

### Goal

Implement Save Engine and prevent fake saved states.

### Scope

Track hashes, dirty/saving/saved/conflict/error, write queue, autosave, `Cmd/Ctrl+S`, tab-switch flush, close guard, conflict detection.

Add persistence target labels:

- disk;
- memory only;
- download required;
- unsupported;
- conflict;
- error.

### Acceptance criteria

- Editing marks dirty.
- `Cmd/Ctrl+S` flushes.
- Autosave works after delay.
- UI never says just `saved` if no real target was persisted.
- Demo distinguishes fixture, imported copy, real writable file, download-only.
- External modification simulation produces conflict.
- No silent overwrite.

### Manual verification

Open a real `.md` where supported, edit, save, close page, reopen file outside demo, verify disk content changed.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because real persistence and save truthfulness are user-critical.

### Reviewer

UX Reviewer and Test Reviewer.

## MME-0009 — Local file open/save in mini web demo

### Goal

Use the mini web demo on actual local Markdown files when browser APIs allow.

### Scope

Implement File System Access API path where supported. Provide fallback import/download mode.

### Acceptance criteria

- User can open a local `.md` file in supported browsers.
- Save writes to original file when writable.
- Fallback mode never pretends to write original file.
- File mode/status is visible.
- Manual QA documented.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this issue opens and saves real local files.

### Reviewer

UX Reviewer.

## MME-0010 — CLI V0 for developers and coding agents

### Goal

Provide CLI entrypoints for setup, validation, fixtures, and inspection.

### Scope

Implement `mme` CLI with:

- `mme init`;
- `mme check`;
- `mme test:fixtures`;
- `mme inspect <file>`;
- `mme format <file>` dry-run;
- `mme format <file> --write` explicit write;
- `mme create-fixture <name>`.

### Acceptance criteria

- CLI runs without Theia.
- `mme test:fixtures` invokes round-trip tests.
- `mme inspect` reports frontmatter, dialect, diagnostics, opaque nodes.
- `mme format` dry-run never writes.
- `--write` is explicit.
- README includes CLI quickstart.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: DX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless CLI write semantics are ambiguous.

### Reviewer

DX Reviewer.

## MME-0011 — Properties UI basics

### Goal

Expose YAML frontmatter as properties in the mini demo.

### Scope

Visible/hidden/source modes.

### Acceptance criteria

- Frontmatter fixture displays properties.
- User can hide/show properties.
- Source mode still shows raw YAML.
- Round-trip preserves frontmatter.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the first properties UI slice.

### Reviewer

UX Reviewer.

## MME-0011.5 — Alignment gate before rich mode

### Goal

Resolve code/document/process drift before starting rich mode.

### Scope

This is a corrective alignment slice, not a product feature slice.

Address:

- pre-rich Document Access Policy baseline;
- reusable `@momentarise/md-source-codemirror` package boundary or a documented blocking plan;
- Momentarise-native parser attributes needed by rich mode;
- serializer readiness decision for targeted edits versus full model serialization;
- human review status cleanup;
- truthful demo labels for fixture/imported/writable/unsupported states;
- README/build-log status alignment.

### Acceptance criteria

- `MME-0012` is not started.
- Minimal `@momentarise/md-policy` baseline exists with automated tests.
- Source CodeMirror setup is reusable outside the demo, or a strict follow-up blocker is documented.
- Parser model exposes native attributes for heading depth, todo checked state, links/images, code fences, and text values without leaking third-party AST keys.
- Targeted serializer edit tests remain the pre-rich serializer proof; full model serialization remains explicitly documented as future work before rich mode can be production-grade.
- Human review statuses are explicit: accepted, rejected, or code-complete/pending human.
- Demo labels do not call non-fixture documents fixtures.
- Unsupported local file state is visible when File System Access is unavailable.
- Properties truncation is visible rather than silent.
- README status matches the build log.
- Build log includes an alignment matrix: gap, decision, files changed, and proof.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless the alignment decision changes scope or weakens a gate.

### Reviewer

Architecture Reviewer, Test Reviewer, UX Reviewer.

## MME-0012 — Rich mode ProseMirror spike

### Goal

Prototype rich mode after parser/save/source gates pass.

### Scope

Support V0 subset: paragraph, headings, emphasis, strong, inline code, lists, todos, blockquote, links, images, horizontal rule, code fence basic, callout simple if feasible, raw fallback.

### Acceptance criteria

- User can switch source/rich.
- Enter/newline works.
- Undo/redo works.
- Editing heading/paragraph serializes correctly.
- Code fence content editable.
- Source/rich switching preserves content.
- Unsupported blocks are safe.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, UX Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the first rich-mode slice.

### Reviewer

Architecture Reviewer, UX Reviewer, Test Reviewer.

## MME-0013 — Slash menu and toolbar V0

### Goal

Add first command UI.

### Scope

Slash menu with fuzzy aliases and toolbar actions.

Commands: paragraph, h1/h2/h3, todo, bullet list, quote, code block, callout, image, divider.

Toolbar: heading, bold, italic, list, todo, quote, code, callout, link, image, source/rich/preview, more menu.

### Acceptance criteria

- `/h1`, `/H1`, `/heading` all find heading.
- Commands insert/transform supported blocks.
- Toolbar actions affect current selection/block.
- Markdown output remains valid.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is a major command UI slice.

### Reviewer

UX Reviewer.

## MME-0013.5 — Rich editor UX input rules and block affordances

### Goal

Make rich mode feel like a serious Markdown editor, using leading editors such as Notion, Obsidian, and BlockNote as UX references while preserving Markdown as the source of truth.

### Scope

Rich-mode Markdown input rules, todo affordances, code-block controls, block-boundary editing behavior, command UI polish, and host-configurable editor UX.

### Acceptance criteria

- Typing safe Markdown prefixes in rich mode transforms the current block live for headings, lists, todos, quotes, and code blocks.
- Typing `- [ ] ` in rich mode renders a todo checkbox row immediately without requiring a Source/Rich mode switch.
- Existing todos render as checkbox rows in rich mode.
- Todo checkbox toggles update Markdown task syntax.
- Code blocks expose language/meta controls for the hidden fence info string.
- Users can add content after the last code block, callout, opaque block, or framed block.
- Slash menu placement, styling, keyboard focus, empty states, and command labels are reviewed against Notion, Obsidian, BlockNote, and similar editor-grade references.
- Toolbar visibility and density are reviewed, including always-visible vs contextual behavior and whether hosts/settings can configure command groups.
- Source/Rich/Live Preview naming and user-facing mode labels are reviewed for clarity.
- Backspace, Enter, paste, selection, and undo/redo remain predictable around transformed blocks.
- Markdown output remains valid and unsupported syntax is not silently destroyed.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this changes core rich editor feel.

### Reviewer

UX Reviewer and Test Reviewer.

## MME-0014 — Folding UI and toggle block distinction

### Goal

Implement hierarchical Markdown section folding without mutating Markdown.

### Scope

- Heading section folding for every heading depth, H1 through H6.
- A folded heading hides every following block until the next heading of the same or higher depth.
- Parent heading folds hide child headings and their descendants.
- Code block and callout folding if feasible after heading section folding is proven.
- Toggle block emitted only when explicitly inserted.

### Acceptance criteria

- Folding any heading level from H1 through H6 hides its descendant section content until the next heading with depth less than or equal to the folded heading.
- Folding an H1 hides H2/H3/H4/H5/H6 descendants and their content until the next H1.
- Folding an H3 hides H4/H5/H6 descendants and their content until the next H3, H2, or H1.
- Folding one H2 does not hide the next sibling H2 or any following higher-level heading.
- Nested fold state behaves predictably when a parent and child heading are both folded/unfolded.
- Folding state does not change Markdown.
- Fold/unfold does not dirty the document, change save hashes, or serialize into the `.md` content.
- Toggle block emits `<details><summary>...</summary>...</details>` only by explicit command.
- Sidecar/session location documented.
- Fixture or demo document includes H1 through H6 nested sections for repeatable tests.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless folding behavior changes visible editor semantics in a way screenshots cannot prove.

### Reviewer

UX Reviewer.

## MME-0015 — HTML File Reader and sandbox preview

### Goal

Support `.html` files as source + sandboxed preview.

### Acceptance criteria

- HTML source opens.
- Preview sandboxed.
- Scripts disabled by default.
- Script fixture proves scripts do not run.
- UI marks HTML as artifact/preview.
- Demo restores the last imported HTML artifact after browser refresh as a download-required copy, without claiming the original disk file is writable.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Security Reviewer and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the HTML preview security/UI gate.

### Reviewer

Security Reviewer.

## MME-0016 — Document Access Policy V0

### Goal

Implement policy resolver and minimal enforcement.

### Clarification

MME-0016 is not about editing `.env` files as product documents. `.env` is a negative security fixture: it proves the policy layer can hard-deny obvious secret-bearing files before AI, indexing, export, or sharing touches them.

`.gitignore` is a different class of file. It is usually not secret by itself, but it can affect repository behavior and should be represented as a policy-sensitive repo-control fixture. The baseline should prove it can be treated differently from `.env`: for example, read may be allowed while write/share/export can be denied by policy depending on host rules.

The core must not decide whether the user sees a disabled button, toast, modal, confirmation prompt, or settings override. It must return enough structured data for the host to choose: decision source, severity, reason, overridable status, and confirmation requirement.

### Acceptance criteria

- Effective policy resolves from defaults, document properties, hard deny.
- `.env` fixture is hard-denied for sensitive actions.
- `.gitignore` fixture is covered as a repo-control/policy-sensitive file, not as a blanket hard-deny.
- Host/app policy can configure rules by capability and path pattern.
- Policy rules can allow, warn, or deny.
- Policy decisions expose source, severity, overrideability, and user-confirmation metadata without importing UI code.
- Read allowed but share denied case works.
- Denied action returns reason and audit record.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Security Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless policy semantics are ambiguous.

### Reviewer

Security Reviewer.

## MME-0017 — AI writing BYOK V0

### Goal

Add document-local AI writing assistance through a host-provided AI provider abstraction.

### Scope

- Core AI contracts for completion, rewrite selection, improve, summarize, title generation, and insert block from prompt.
- Mock provider for tests and demo.
- BYOK session shape in the demo, stored in memory only.
- Policy gate before any provider receives document content.
- Accept/reject suggestion flow.

### Architecture decision

MME core must not depend on LiteLLM, OpenAI, Anthropic, Vercel AI SDK, browser fetch, or any provider SDK.

MME core exposes an AI provider contract. Hosts decide how to fulfill it:

- mock provider for tests and demos;
- memory-only BYOK for local/personal demos;
- host-managed backend session for production apps;
- local gateway for self-hosted/personal setups;
- future OpenAI-compatible provider adapter, which can point at LiteLLM.

Momentarise product should use:

```txt
MME editor -> Momentarise backend -> LiteLLM -> model providers
```

LiteLLM is the recommended/official gateway for Momentarise-managed AI, but it is not a dependency of the MME core package. Direct browser-to-LiteLLM production use is not the default recommendation because key exposure, quotas, audit, billing, and policy enforcement belong behind a host/backend boundary.

### Acceptance criteria

- `@momentarise/md-ai` exposes a provider/session contract without host or provider SDK imports.
- Mock provider works in automated tests.
- BYOK session control works in demo with memory-only key handling.
- Key is not logged, persisted, exposed on the session object, or stored in screenshots/build log/test output.
- Policy checked before sending content.
- Policy denial prevents provider calls.
- Suggestions are accepted/rejected, not silently applied.
- Future LiteLLM/OpenAI-compatible integration path is documented as host/backend or provider-adapter work, not core behavior.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Security Reviewer, UX Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the AI writing UI and policy boundary.

### Reviewer

Security Reviewer and UX Reviewer.

## MME-0018 — Reference Editor Surface V0

### Status

Code-complete; human review pending; scripted visual verification pending (local headless Chrome/CDP `SIGABRT`).

MME-0018 must not be accepted as final while derived-view preservation blockers remain. The 2026-06-09 framework review found that rich mode (a) silently rewrites the whole document through a normalizing serializer on every rich edit and (b) destroys GFM tables and strikethrough through a lossy fallback mapping. These are split into `MME-0019` and `MME-0020`. The recommended human decision is: accept the MME-0018 surface direction, redirect preservation integrity to `MME-0019`/`MME-0020` before any adapter work.

### Goal

Turn the mini web demo into a credible reference editor surface before adapting MME into Theia or other hosts.

This issue exists because MME's value is not "another Markdown reader". The value is a premium BlockNote/Obsidian-inspired editing experience over real portable `.md` files, usable across web, desktop, mobile/tablet, IDE, web IDE, and mixed product/IDE surfaces.

### Scope

- Editor-first layout that makes the document the primary surface.
- Demote inspector/debug panels from normal user-facing chrome.
- Define responsive behavior for desktop, tablet, mobile, web app, desktop app, IDE-like shell, and mixed host shells.
- Replace demo-grade controls with an editor-grade toolbar, slash menu, compact mode control, command surface, and document status pattern.
- Integrate AI writing into real editor entry points: slash menu, toolbar/contextual toolbar, selected-text actions, and command palette-style flows.
- Keep the existing AI inspector/debug panel only as dev/debug support if still useful.
- Define host-configurable preferences for toolbar behavior, glass/compact styling, control visibility, AI entry points, technical status disclosure, and optional stats.
- Provide a settings contract so host apps can plug real user/workspace/admin settings into MME without forking UI logic.
- Polish visible block affordances for headings, paragraphs, lists, todos, quotes, code fences, callouts, images, raw/opaque blocks, and document-end insertion.
- Define premium todo/checkbox rendering, nested indentation, indentation guides, and list/todo continuation expectations.
- Define clear Source/Rich/Live Preview/HTML Preview mode presentation per document type.
- Document reference and license boundaries for third-party inspiration.

### Reference boundaries

Use references as benchmarks, not as code to copy.

- Notion and BlockNote: slash-menu categories, block insertion, block-level affordances, empty states, keyboard flow.
- BlockNote, Google Docs/Gemini, and Microsoft Copilot in Word: AI writing action families and explicit accept/reject insertion.
- Obsidian default Live Preview: Markdown-first editing feel.
- Obsidian Editing Toolbar plugin: toolbar positioning, configurable command groups, dropdown/submenu organization, compact/shrink behavior, and optional glass-like styling.

The Obsidian Editing Toolbar plugin is MPL-2.0. MME must not copy code, assets, or exact protected styling unless reuse is explicitly license-compliant. Prefer clean-room implementation from interaction requirements and visual references.

### Acceptance criteria

- PRD explains that MME targets a premium Markdown-native editor surface, not only a plain Markdown reader or technical demo.
- Demo no longer presents the inspector/debug panel as the main place for user-facing actions.
- User-facing AI actions are reachable from editor-native entry points, not only from an inspector/debug panel.
- AI action taxonomy includes at least: continue, draft/insert, rewrite, improve, shorten, expand, summarize, tone change, explain, translate, turn into list/checklist/table where supported, and accept/reject.
- Slash menu taxonomy is reviewed against Notion and BlockNote and includes clear grouping, labels, aliases, empty states, keyboard navigation, and insertion behavior.
- Toolbar interaction is reviewed against Obsidian Editing Toolbar-style patterns: top/floating/following/contextual positioning, command groups, dropdowns/submenus, compact/shrink behavior, and optional glass-like visual mode.
- Toolbar appearance is implemented as MME-owned design tokens/components, not copied plugin code or assets.
- Host preferences contract supports toolbar mode, toolbar style, visible command groups, AI entry points, technical status disclosure, optional stats, and per-host defaults.
- Settings UI is optional for end users but easy for host apps to connect to real settings.
- Responsive checks cover at least mobile, tablet, desktop, narrow web-app window, and IDE-like constrained viewport.
- Block UI feels product-grade: todos, lists, indentation, code fences, block insertion, and document-end editing must not look or behave like unfinished debug controls.
- Permanent file URI/persistence/debug metadata is moved into a discreet editor-grade status affordance while preserving save truthfulness.
- Source/Rich/Live Preview/HTML Preview mode control is compact, document-kind aware, and not a demo segmented control.
- Visual impact is documented for editing surface and general UI.
- Screenshots are captured under `docs/internal/visual-checks/MME-0018/`.
- Human review is required before adapter work continues.

### Test-first plan

- RED: Add or update static baseline tests requiring the reference editor surface contract, AI entry points outside the inspector, host preference contract, and visual artifact directory.
- RED: Add visual/manual scenario before implementation covering responsive layouts, toolbar/slash/AI entry points, document status, and block affordances.
- GREEN: Implement the smallest serious reference surface that satisfies the contract without starting Theia.
- REFACTOR: Extract reusable UI contracts/tokens/components where they reduce adapter risk.

### Manual verification

Required.

Manual UI scenario must include:

- desktop editor use;
- narrow browser/window use;
- tablet-width viewport;
- mobile-width viewport;
- rich editor toolbar and slash menu;
- selected-text AI action;
- slash-menu AI action;
- compact mode switching;
- nested list/todo editing;
- code fence editing and insertion after the final block;
- document status/save truth affordance.

### Visual impact

Major visible editing-surface and general UI change. This issue should make the demo feel like a reference editor surface rather than a technical harness.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer, Architecture Reviewer, Test Reviewer, DX Reviewer, and Security/License Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this defines the product/editor surface before adapters.

### Reviewer

UX Reviewer, Architecture Reviewer, Test Reviewer, DX Reviewer, and Security/License Reviewer.

## Renumbering note (2026-06-09)

The public-framework readiness review inserted new issues before adapter work:

- Previous `MME-0019 — Theia adapter alpha` is now `MME-0034`.
- Previous `MME-0020 — Host adapter external-change strategy` is now `MME-0035`.

Phases: A integrity (0019–0022), B headless engine and packaging (0023–0024), C contracts (0025–0027), D surface and bindings (0028–0031), E product surfaces (0032–0033), F adapters (0034–0035), G publish and docs (0036–0038). `MME-0039` (interim demo visual refresh) ran out of phase order by explicit human decision on 2026-06-10.

## Agent capability guidance (2026-06-10)

Every open issue carries an `### Implementation notes` section written for the implementing agent. The notes close the documentation gap, but some issues inherently require stronger coding ability regardless of documentation quality. Match the agent to the issue:

| Issue | Difficulty | Minimum agent profile |
| :-- | :-- | :-- |
| MME-0020 | Medium | Mid-tier model; notes are near-recipe; byte-level test discipline required |
| MME-0021 | High | Strong model; ProseMirror transaction/split internals beyond what notes can encode |
| MME-0022 | Medium | Mid-tier model; mostly substitution + jsdom test setup from the notes |
| MME-0023 | High | Strong model; API extraction judgment across packages |
| MME-0024 | Medium | Mid-tier model; mechanical but broad; smoke harness needs care |
| MME-0025 | Medium | Mid-tier model; contracts are fully specified in the notes |
| MME-0026 | Medium-High | Solid model; resolver is specified but CM/PM live-reconfigure needs editor knowledge |
| MME-0027 | High | Strong model; public API design judgment |
| MME-0028 | High | Strong model; large extraction with a11y and test migration |
| MME-0029 | High | Strong model; PM decorations/drag plus the order-aware matcher fix |
| MME-0030 | Medium | Design-capable model; CSS-only over tokens, automated contrast gate |
| MME-0031 | Medium | Mid-tier model; binding is thin, harness is scripted |
| MME-0032 | Medium-High | Solid model; pipeline is prescribed but sanitization is a security boundary |
| MME-0033 | Medium | Mid-tier model with the notes' mapping helper guidance |
| MME-0034 | High | Strong model; Theia shell knowledge |
| MME-0035 | Low-Medium | Mid-tier model; contract + one injected watcher |
| MME-0036 | Medium | Mid-tier model; checklists, but security items need review rigor |
| MME-0037 | Low-Medium | Any competent writer-model; rules are explicit |
| MME-0038 | Medium-High | Solid model; site assembly across three MME packages |

A weak coding model can execute Low/Medium issues from the notes alone with reviewer gates; High issues will fail on editor internals (ProseMirror, extraction judgment) regardless of documentation and should keep a strong implementation agent.

## Small-model / autonomous execution protocol (read this first)

An autonomous implementation agent should follow exactly this loop. Do not improvise around it. Implement issues one by one in this file's order unless the human explicitly changes the order or the next issue is blocked. A new session is not required when the human explicitly asks for autonomous issue-by-issue execution, but a fresh context rebuild is required before every issue.

1. Rebuild context, in order: `AGENT.md`, `README.md`, `docs/internal/PRD.md`, `docs/internal/QUALITY_GATES.md`, this file, the latest `docs/internal/build-log.md` entries, `git status --short`, then the files named in the target issue's `### Implementation notes`. Never rely on chat memory.
2. Current project state: **MME-0027 — Extension registry V0** is completed and human-accepted. The current issue is **MME-0028 — Editor surface package with i18n and accessibility**.
3. Before editing, output a `Pre-Issue Execution Plan`: issue id, why it is unblocked, intended files/folders to create or modify, tests/checks, gates, reviewer plan, assumptions, and stop conditions.
4. Test-first: create/identify the RED test named in the issue's notes, confirm it fails, then write the smallest serious fix. The notes give exact files, an API sketch, and the RED test filename. Wire any new test into root `package.json` `test`.
5. Honor the non-negotiables every time: Markdown stays the durable source; derived views round-trip untouched documents byte-for-byte (Gate 4.5); unknown syntax becomes raw/opaque, never flattened; no full-document rewrite on edit; core packages stay host-independent (the `tests/no-host-imports.mjs` gate); AI stays assistive and policy-gated; UI consumes `--mme-*` tokens with zero hardcoded colors (Gate 13).
6. Verify cheaply first: run the issue's targeted test, then `npm test`. Run browser/CDP visual scripts only when the issue changes visible UI and budget allows; otherwise mark visual verification pending per Gate 0.8 and say so.
7. Close out: update `docs/internal/build-log.md` (what changed, tests, visual impact, reviewer/fallback, suggested commit message, next issue), update README status if the slice completed, add a `### Status: completed` line to the issue here.
8. Commit: after reviewer/fallback validation accepts the issue and no HITL gate blocks it, create an issue-scoped commit before moving on. Do not start the next issue with an uncommitted completed issue.
9. Before choosing the next issue, output a short handoff: finished issue/status, evidence, reviewer result, commit hash or commit blocker, residual risks, human decision needed if any, and next candidate issue if obvious.
10. STOP and ask the human when: the issue says human review required; a preservation/security/licensing/AI-boundary/public-release decision is needed; tests cannot honestly pass; or any uncertainty remains. If the human asked for full autonomous issue-by-issue execution and every continuation gate in `CLAUDE.md` is met, keep going through all subsequent unblocked issues in order until one of those stop conditions appears.

Definition of done for any issue = every acceptance criterion has explicit evidence (test, screenshot, fixture, or reviewer statement). "It builds" is not done.

## MME-0019 — Rich-mode round-trip fidelity gate

### Status

Completed 2026-06-10. See the build log entry for evidence. Gate 4.5 holds for untouched documents across the full fixture corpus; the whitelist mapper, byte-preserving serializer, `strike` mark, and opaque-detection fixes landed in `packages/md-rich-prosemirror/src/index.ts` and `packages/md-format/src/index.ts`, proven by `tests/rich-roundtrip-fidelity.test.mjs` and `scripts/visual-check-mme0019.mjs`. Known limitations are explicitly owned by MME-0020 (separators around edited blocks), MME-0021 (inline fidelity during list edits), and MME-0029 (order-aware matching for drag reorder).

### Goal

Stop derived-view data corruption. Rich mode must never destroy or approximate Markdown content it does not explicitly support.

### Scope

- Corpus-wide identity test: for every fixture, mounting rich state and serializing back without edits must return the input bytes.
- Invert the rich mapping to a closed whitelist: any node type outside the supported V0 subset becomes `unsupported_block` carrying raw source, never a flattened paragraph.
- GFM tables, strikethrough, footnotes, and definitions must survive rich mount + serialize untouched.
- Fix opaque-detection false positives in `@momentarise/md-format`: inline `$...$` matching currency amounts, and callout/wikilink/Mermaid/LaTeX patterns matching inside fenced code regions.

### Test-first plan

- RED: add `tests/rich-roundtrip-fidelity.test.mjs` asserting byte-identical round-trip for all fixtures; it must fail on the table fixture before the fix.
- GREEN: whitelist mapping + opaque fallback + regex masking of fenced regions.

### Acceptance criteria

- All 18 fixtures pass the rich round-trip identity test byte-for-byte.
- The lossy default branch (`children -> paragraph`) is removed from the rich mapper.
- A document containing `$5 and $10` produces no LaTeX opaque diagnostic.
- Wikilink/Mermaid/callout text inside a fenced code block produces no opaque node.
- All existing tests pass; no editor UI change is required.
- Visual impact: unsupported blocks render as raw/opaque blocks in rich mode instead of corrupted paragraphs; otherwise no general UI change.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Test Reviewer and Architecture Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless fidelity cannot be proven for a fixture class.

### Reviewer

Test Reviewer and Architecture Reviewer.

## MME-0020 — Targeted rich serialization and no-rewrite saves

### Status

Completed 2026-06-13. Human accepted the preservation contract and restored-copy/folding-chevron review follow-ups; see the build log for evidence. `MME-0021` is now unblocked.

### Goal

A rich edit must change only the edited blocks in the persisted Markdown. No full-document normalization on edit, autosave, copy, or mode switch.

### Scope

- Identify edited top-level blocks (MME-0019 already does this through expected-pairs `node.eq` matching in `serializeRichMarkdownContent`; transaction mapping or `serializeMarkdownEdits` splicing are acceptable alternatives only if the byte-level tests stay green).
- Correct separators around edited/inserted blocks so reconstructed neighbors cannot lazily merge on reparse.
- When `richChanged` is false, `getMarkdown()`, copy, download, and save must return the untouched baseline source.
- Flush with reason `mode-switch` on mode changes, per the Save Engine contract.

### Test-first plan

- RED: edit one heading in rich mode on a mixed fixture; assert every other line is byte-identical. Assert copy-in-untouched-rich-mode equals the original source.

### Acceptance criteria

- Editing one block in rich mode preserves all unrelated source bytes, including list markers, blank-line runs, setext headings, and emphasis style outside the edited block.
- Two reconstructed paragraphs are separated by a blank line so they do not merge into one paragraph on reparse.
- Untouched rich documents produce zero byte changes through save/copy/download.
- Autosave after a rich edit writes only the targeted change to the save target.
- Mode switch uses the `mode-switch` flush reason.
- Round-trip and edited-range suites pass.
- Visual impact: no visible UI change; behavior-only preservation fix.

### Implementation notes

Read these files completely before coding: `packages/md-rich-prosemirror/src/index.ts` (function `serializeRichMarkdownContent` — the MME-0019 byte-preserving serializer), `apps/md-demo/src/main.ts` (functions `switchEditorMode`, `syncRichMarkdownToSource`, `getMarkdown`, `flushSave`, `memorySave`), `packages/md-save/src/index.ts` (`SaveFlushReason` already includes `"mode-switch"` at line ~10), `tests/rich-roundtrip-fidelity.test.mjs`, `tests/rich-input-rules.test.mjs`.

State after MME-0019 (do not redo this work):

- Untouched blocks already emit original source bytes; untouched documents are already byte-identical, so the copy/save AC mostly needs regression tests, not new code.
- Remaining gap 1 — separators: in `serializeRichMarkdownContent`, edited/inserted blocks join neighbors with a single `"\n"` (kept for compatibility with the `"```\nNext paragraph"` assertion in `tests/rich-input-rules.test.mjs`). Fix: when a block does not match, check whether the block at `pairs[pointer]` is skipped by the NEXT matched block (next match index === pointer + 1). If so, the edited block replaced `pairs[pointer]`: reuse that entry's original gap-before (`source.slice(pairs[pointer - 1].model.sourceRange.end.offset, pairs[pointer].model.sourceRange.start.offset)`) and advance `pointer`. For genuinely inserted blocks (no replaced entry), default the separator to `"\n\n"`. Then deliberately update the `"```\nNext paragraph"` expectation in `tests/rich-input-rules.test.mjs` to `"```\n\nNext paragraph"` and record that as an intentional behavior fix in the build log.
- Remaining gap 2 — mode-switch flush: in `apps/md-demo/src/main.ts` `switchEditorMode`, after `syncRichMarkdownToSource("mode switch")`, call `void flushSave("mode-switch")`. Add a demo-level or save-engine test asserting the reason reaches the `SaveTarget.write` request (`SaveTargetWriteRequest.reason`).
- Remaining gap 3 — proof: new `tests/rich-targeted-serialization.test.mjs`. Use `fixtures/014-mixed-real-world/input.md`, edit one heading via `replaceFirstRichText`, then compare line arrays: every line outside the edited heading must be byte-identical. Also assert a `createMemorySaveTarget` write after a rich edit contains the untouched table/mermaid lines verbatim.

Pitfalls:

- Do NOT reconstruct the whole document and diff afterwards; the per-block segments approach is the contract.
- Do NOT weaken `tests/rich-roundtrip-fidelity.test.mjs`; it must stay green unchanged.
- The reviewer caveat from MME-0019: block reordering emits `"\n"` separators because matching is sequential. Reordering is unreachable from the current UI; leave it to MME-0029, but keep the matcher code commented accordingly.
- Inline emphasis style (`_x_` vs `*x*`) inside an EDITED paragraph still normalizes; that is out of scope here (tracked under MME-BACKLOG inline fidelity) — do not chase it.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Test Reviewer and Architecture Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the preservation contract for rich editing.

### Reviewer

Test Reviewer and Architecture Reviewer.

## MME-0021 — Rich list and todo editing baseline

### Status

Completed 2026-06-20; human accepted the rich list/todo editing behavior after review-fix passes for caret placement after list Enter, empty-item nesting/outdent, empty parent-item Backspace after nested lists, Backspace selection placement, keyboard todo toggling, and dash-space before existing text. `MME-0022` is unblocked.

### Goal

Make list editing in rich mode behave like Notion/BlockNote-class editors.

### Scope

- Enter inside a list item creates a new list item (not a paragraph inside the same item); same for todo items.
- Enter on an empty item exits the list.
- Tab / Shift+Tab nest and outdent list and todo items.
- Backspace at item start merges/lifts predictably.
- Input-rule parity: `#` through `######`, `*` and `+` bullets, rules usable mid-document, single Undo restores the typed prefix.

### Acceptance criteria

- Automated tests prove Enter/Tab/Shift+Tab/Backspace behavior for bullet, ordered, and todo items, including nested cases.
- Serialized Markdown for nested lists/todos round-trips through the fidelity gate.
- H4–H6 and `*`/`+` input rules work; undo after an input rule restores the literal text.
- No regression in MME-0019/MME-0020 suites.
- Visual impact: editing-surface behavior change only; screenshots of nested list/todo editing captured under `docs/internal/visual-checks/MME-0021/`.

### Implementation notes

All work is in `packages/md-rich-prosemirror/src/index.ts` plus new tests. Read first: `createMomentariseRichPlugins` (the Enter chain is `chainCommands(newlineInCode, splitTodoItemAtEnd, createParagraphNear, liftEmptyBlock, splitBlock)`), `createTodoItemEnterTransaction`, `findAncestorDepth`, `markdownInputRuleForText`, `createListTodoInputRuleTransaction`, the node specs (`list_item` and `todo_item` both have content `"paragraph block*"`), and the test helpers `typeIntoRichState` / `pressEnterInRichState` in `tests/rich-input-rules.test.mjs` (they iterate `editorState.plugins` and call `props.handleKeyDown`, which DOES exercise keymap plugins — reuse them).

The core bug: for plain `list_item`, Enter falls through to `splitBlock`, which splits the paragraph INSIDE the same `<li>` instead of creating a new item.

1. Implement `splitListItemCommand(state, dispatch)`: locate the ancestor item depth with `findAncestorDepth($from, "list_item") ?? findAncestorDepth($from, "todo_item")`. If the selection is inside the item's paragraph and the item is non-empty, use `tr.split($from.pos, 2, typesAfter)` where `typesAfter = [{type: itemType, attrs: itemType.name === "todo_item" ? { checked: false } : null}, {type: schema.nodes.paragraph}]` — splitting depth 2 cuts through paragraph + item and carries trailing text into the new item (Notion behavior, works mid-text, not only at end). New todo items must reset `checked: false`. Replace/absorb `splitTodoItemAtEnd` with this generalized command; keep it BEFORE `createParagraphNear` in the chain.
2. Empty-item Enter exits the list: if the item's paragraph is empty, lift the item out (adapt `liftListItem` semantics; see note 3). Top-level single-item lists must collapse to a paragraph (mirror the logic in `createListTodoInputRuleTransaction` which already handles the single-child-list-at-doc case).
3. Tab/Shift+Tab: adapt the `sinkListItem`/`liftListItem` algorithms from `prosemirror-schema-list` (MIT) to accept BOTH item types `{list_item, todo_item}` — the stock helpers take exactly one NodeType, which is why they cannot be used directly. Sink wraps the item in a new list of the parent list's type and appends it to the previous sibling item; lift moves it to the outer list or out of the list. Bind `{ Tab: sink, "Shift-Tab": lift }` in `createMomentariseRichPlugins`, returning `false` when the selection is not inside an item so the event can propagate.
4. Backspace at the start of an item's first paragraph: first item of the list → lift out; otherwise let `joinBackward` merge into the previous item — verify with tests and only add a custom command if stock behavior fails.
5. Input rules in `markdownInputRuleForText`: change heading regex `/^(#{1,3}) $/` to `/^(#{1,6}) $/`; accept `"* "` and `"+ "` alongside `"- "` for `bullet_list`. Relax the position guard: rules currently require `$from.parentOffset === $from.parent.content.size` (end of paragraph) — change to `$from.parentOffset === prefix.length` so the rule fires when the cursor sits right after the typed prefix even mid-document; also allow the paragraph to live inside a `list_item`/`todo_item` (nested transforms), not only at top level.
6. Undo contract: the transforms run via `appendTransaction`; verify with `prosemirror-history` `undo` that one undo restores the literal typed prefix (e.g. `"- "`); if history merges too aggressively, set `addToHistory`/`tr.setMeta` accordingly and prove it in a test.
7. Round-trip safety: after every new behavior, serialize and re-parse (`serializeRichMarkdownState` → `createRichMarkdownState`) and assert `doc.eq` — nested 2-space indentation must survive the fidelity gate (`fixtures/018-nested-lists-todos` is the reference shape: ordered list with 3-space continuation indent and nested todos).

RED file: `tests/rich-list-editing.test.mjs` (copy the two helpers from `tests/rich-input-rules.test.mjs`). Wire `test:rich-list-editing` into root `test` in `package.json`. Visual script: clone `scripts/visual-check-mme0019.mjs` structure, capture nested todo editing before/after Tab.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this changes core rich editor feel.

### Reviewer

UX Reviewer and Test Reviewer.

## MME-0022 — Source-mode keymap integrity

### Status

Completed 2026-06-20. Source mode now composes CodeMirror explicitly without `basicSetup`, disables the hidden Markdown keymap in `markdown()`, uses the official Markdown keymap for continuation/backspace, preserves MME's one-press empty item exit, and has browser/CDP proof in `scripts/visual-check-mme0022.mjs`.

### Goal

Make the composed CodeMirror extension stack provably correct, replacing hand-rolled duplication with the official Markdown keymap.

### Scope

- Adopt `@codemirror/lang-markdown` `markdownKeymap` (`insertNewlineContinueMarkup`, `deleteMarkupBackward`).
- Remove duplicate extensions already provided by `basicSetup` (close brackets, bracket matching, history/default keymaps) and fix keymap precedence so MME bindings demonstrably win.
- Keep `Mod-s` save hook and empty-item exit behavior.
- Add blockquote continuation.

### Acceptance criteria

- Real keydown-event tests against the composed extension stack (not unit-called helpers) prove list, checkbox, and blockquote continuation, and empty-item exit.
- No duplicate keymap/extension instances remain in `createMomentariseSourceExtensions`.
- Smart backspace removes list markup per `deleteMarkupBackward`.
- All source-mode suites pass.
- Visual impact: editing-surface behavior only; no general UI change.

### Implementation notes

All code work is in `packages/md-source-codemirror/src/index.ts`. Read FIRST and keep their contracts (or update them deliberately with justification): `tests/source-codemirror-package.test.mjs` and `tests/source-editing-ux-baseline.test.mjs` (they assert exports such as `createMomentariseSourceExtensions` and `momentariseSourceKeymap`).

The bug to fix: `createMomentariseSourceExtensions` puts `basicSetup` FIRST in the extension array, and `basicSetup` (from the `codemirror` package) already bundles `defaultKeymap`, `historyKeymap`, `closeBracketsKeymap`, `searchKeymap`, plus `closeBrackets()`, `bracketMatching()`, `history()`. In CodeMirror 6, earlier extensions win for the same key, so basicSetup's Enter (`insertNewlineAndIndent`) shadows the custom `continueMarkdownList` Enter, and several extensions are instantiated twice.

1. Drop `basicSetup` entirely. Compose explicitly (all already available via existing deps): `lineNumbers()`, `highlightActiveLineGutter()`, `highlightSpecialChars()`, `history()`, `drawSelection()`, `dropCursor()`, `EditorState.allowMultipleSelections.of(true)`, `indentOnInput()`, `syntaxHighlighting(defaultHighlightStyle, { fallback: true })`, `bracketMatching()`, `closeBrackets()`, `highlightActiveLine()`, `highlightSelectionMatches()`, then exactly ONE `keymap.of([...])` in THIS priority order: the `Mod-s` save binding, `...markdownKeymap` (from `@codemirror/lang-markdown` — binds Enter to `insertNewlineContinueMarkup` and Backspace to `deleteMarkupBackward`), `...closeBracketsKeymap`, `...defaultKeymap`, `...searchKeymap`, `...historyKeymap`, `indentWithTab`.
2. Delete the hand-rolled helpers `continueMarkdownList`, `exitEmptyCheckboxItem`, `exitEmptyMarkdownListItem`, `continueCheckboxItem`, `continueListItem` — `insertNewlineContinueMarkup` already handles list/task continuation, empty-item exit, blockquote continuation, and ordered renumbering. Keep the exported `momentariseSourceKeymap(options)` name returning the Mod-s + markdown bindings so package tests stay valid.
3. Tests (the whole point of this issue is proving the COMPOSED stack, not unit helpers): add `jsdom` to root devDependencies. New `tests/source-keymap-integrity.test.mjs`: create a JSDOM window (`pretendToBeVisual: true`), register `window`/`document` globals, stub what CodeMirror needs under jsdom (`globalThis.requestAnimationFrame`, `Range.prototype.getClientRects` and `getBoundingClientRect` returning zero-rects), mount `new EditorView({ parent: document.body, state: EditorState.create({ doc, extensions: createMomentariseSourceExtensions({ onSave }) }) })`, set the selection explicitly, then dispatch real events: `view.contentDOM.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))` and assert `view.state.doc.toString()`.
4. Required cases: `- item` + Enter → new `- ` line; `- [ ] x` + Enter → `- [ ] ` continuation; Enter on an empty `- ` item → marker removed (exit); `> quote` + Enter → `> ` continuation; Backspace just after `- ` → marker removed (`deleteMarkupBackward`); Cmd/Ctrl-S → `onSave` called exactly once and default prevented.
5. Fallback if jsdom proves unworkable for CodeMirror selection APIs: a CDP-based behavior script cloned from `scripts/visual-check-mme0019.mjs` asserting the same cases through the demo, documented in the build log as the chosen vehicle.

Pitfall: do not change `createMomentariseSourceExtensions`'s signature; the demo (`apps/md-demo/src/main.ts` editor construction) consumes it as-is.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless source-editing behavior regresses.

### Reviewer

Test Reviewer.

## MME-0023 — Headless editor session and events

### Status

Completed 2026-06-24; human accepted MME-0023 and authorized continuing after commit/push. Added the DOM-free `@momentarise/md-editor` package, moved session-owned canonical content/save orchestration/AI suggestion state out of the demo, added hash anchoring and stale accept refusal for AI suggestions, extended architecture/type/headless lifecycle tests, and re-captured MME-0018 visual artifacts after proving the demo still runs through the session. Human review then rejected the visible AI assistant pattern as too debug-panel-like; the review fix converts it into a compact fixed editor popover with MME-0023 visual proof. Follow-up AI usability/provider work is split into `MME-0028.5` and `MME-0028.6`.

### Goal

Create the missing keystone abstraction: a host-independent, DOM-free `MarkdownEditorSession` in a new `@momentarise/md-editor` package, so every host binds views to a session instead of reimplementing orchestration.

### Scope

- Session owns: canonical Markdown content, parse cache and source maps, block-level edit application, Save Engine orchestration with an injectable scheduler (no `window.setTimeout` in the package), policy hooks, and the AI request/suggestion controller currently entangled with the demo debug panel.
- Event subscription API designed against Tiptap's taxonomy: `onChange`, `onSaveStateChange`, `onDiagnostics`, `onModeChange`, `onSelectionContext`, `onDestroy`.
- Mode registry: views attach/detach; the session defines content handoff between source/rich/preview.
- The demo migrates its save, content, mode-switch, and AI flows to the session as the first consumer proof.
- Extend the `no-host-imports` architecture gate to cover `packages/md-editor/src`.

### Acceptance criteria

- `@momentarise/md-editor` imports no DOM, browser, React, CodeMirror, ProseMirror, Theia, or provider APIs.
- A headless Node test drives a full session lifecycle: open, edit blocks, autosave via injected scheduler, conflict, AI suggest/accept with policy gate, events observed.
- Demo `main.ts` no longer owns save orchestration, AI state, or canonical content; it consumes the session.
- AI suggestions record the document hash at generation time and refuse or re-anchor on mismatch at accept time.
- `getMarkdown()` semantics are session-owned and mode-independent.
- Visual impact: no intended visible change; demo behavior must remain equivalent and is re-verified.

### Implementation notes

New package `packages/md-editor` (copy `packages/md-save`'s package.json/tsconfig shape; dependencies: `@momentarise/md-core`, `md-format`, `md-save`, `md-policy`, `md-ai`; absolutely no DOM/browser API). Wire into root `package.json` build script, root `tsconfig.json` references, and `tsconfig.base.json` paths. Extend `tests/no-host-imports.mjs` `checkedSourceRoots` with `"packages/md-editor/src"`.

Target public API (adjust names only with reviewer agreement):

```ts
export type SessionEvent = "change" | "save-state" | "diagnostics" | "mode" | "destroy";
export interface SessionScheduler {
  schedule(callback: () => void, delayMs: number): () => void; // returns cancel
}
export interface MarkdownEditorSessionOptions {
  readonly content: string;
  readonly target: SaveTarget;
  readonly scheduler: SessionScheduler;
  readonly autosaveDelayMs?: number;
  readonly dialect?: DocumentDialect;
  readonly path?: string | null;
  readonly policyResolver?: PolicyResolver;
  readonly aiProvider?: AiProvider;
}
export interface MarkdownEditorSession {
  getContent(): string;
  getParseResult(): ParseResult;            // cached; invalidated by setContent
  setContent(next: string, origin: "source-view" | "rich-view" | "ai" | "host"): void;
  getSaveState(): SaveState;
  flush(reason: SaveFlushReason): Promise<SaveFlushResult>;
  getMode(): EditorMode;
  setMode(mode: EditorMode): void;
  startAiSession(apiKey: string): void;     // memory-only; never stored/logged
  requestAiSuggestion(request: Omit<AiWritingRequest, "document">): Promise<AiWritingSuggestion>;
  acceptPendingSuggestion(): string | null; // applied content or null when stale/absent
  rejectPendingSuggestion(): void;
  on(event: SessionEvent, handler: (payload: unknown) => void): () => void;
  destroy(): void;
}
```

What moves OUT of `apps/md-demo/src/main.ts` into the session: the autosave timer pair `scheduleAutosave`/`clearAutosaveTimer` (replace `window.setTimeout` with the injected scheduler; the demo supplies `{ schedule: (cb, ms) => { const id = window.setTimeout(cb, ms); return () => window.clearTimeout(id); } }`), the `flushSave` orchestration core, the AI flow state (`aiSession`, `pendingAiSuggestion`, `generateAiSuggestion`, accept/reject), and canonical-content ownership (`getMarkdown` becomes `session.getContent()`; CodeMirror updates and rich syncs call `session.setContent`). The demo KEEPS: DOM rendering, event log, `persistRestorableDocument`/localStorage restore, CM/PM view construction.

`@momentarise/md-ai` change (hash anchoring): add `readonly baseHash: DocumentHash` to `AiWritingSuggestion`, computed with `hashMarkdownContent(request.document.content)` inside `requestAiSuggestion`; extend `AiSuggestionStatus` with `"stale"`; `acceptAiSuggestion(content, suggestion)` must return unchanged content with `status: "stale"` when `hashMarkdownContent(content) !== suggestion.baseHash`. Update `tests/ai-writing.test.mjs` and `tests/type-contracts.test.ts` additively.

RED first: `tests/editor-session.test.mjs` drives a full headless lifecycle with a FAKE scheduler (manual `tick()` array of callbacks), `createMemorySaveTarget`, `createMockAiProvider`, and the default policy resolver: open → edit → events observed in order → autosave fires only via scheduler tick → conflict path (simulateExternalChange) → AI suggest/accept with policy gate → stale-suggestion refusal after a concurrent edit → destroy unsubscribes everything.

Completion proof: all existing demo-* baseline tests stay green; `npm run visual:mme-0018` re-captured to show no visual regression.

Pitfalls: no `Date.now`-based scheduling inside the package without injection (Save Engine already accepts `now` — keep that pattern); do not import CodeMirror/ProseMirror types; events must fire AFTER state mutation completes; `destroy()` must cancel pending scheduler callbacks.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this defines the public core API.

### Reviewer

Architecture Reviewer.

## MME-0024 — Publishable package restructure

### Status

Completed 2026-06-25; human accepted the package graph, smoke-harness result, and dependency-policy boundary. Commit and push are authorized before moving to `MME-0025`.

### Goal

Make the package graph survive real package managers and external consumers.

### Scope

- View packages declare CodeMirror and ProseMirror packages as `peerDependencies`; add the missing `prosemirror-view`/`prosemirror-transform` declarations; the demo stops re-declaring editor-engine deps it gets through MME packages.
- Move model-level Markdown generation (Momentarise node tree to Markdown text) into `@momentarise/md-format` as the real serializer; the rich package keeps only the ProseMirror-to-Momentarise-node bridge.
- Single hash implementation (fnv1a-64) shared by `md-format` and `md-save`.
- Internal dependency ranges and release-readiness fields (`repository`, `engines`, `keywords`) on every package; tighten `NodeId` branding.

### Acceptance criteria

- A scripted `npm pack` + install into a throwaway consumer works under npm and pnpm strict mode (no phantom dependencies).
- A duplicate-instance check proves one `@codemirror/state` and one `prosemirror-model` in the consumer bundle.
- `md-format` exposes the model serializer; identity behavior for untouched documents is preserved and the MME-0019 fidelity suite passes against it.
- One hash function across packages; round-trip and save suites pass.
- Visual impact: no visible editing or general UI changes.

### Implementation notes

Four independent work streams; land them in this order.

1. Peer dependencies. `packages/md-source-codemirror/package.json`: move all seven `@codemirror/*` + `codemirror` entries from `dependencies` to BOTH `peerDependencies` (same `^6` ranges) and `devDependencies` (for local build). `packages/md-rich-prosemirror/package.json`: move every `prosemirror-*` entry to peers + devDeps and ADD the missing `prosemirror-transform` (instances cross the consumer boundary via `EditorState`); the package does not import `prosemirror-view` — the demo legitimately owns that dependency. The demo keeps its direct `@codemirror/*`/`prosemirror-state`/`prosemirror-view` deps (it constructs the views) but versions must satisfy the peers; prove single instances with `npm ls @codemirror/state prosemirror-model` in the smoke harness.
2. Serializer split. New `@momentarise/md-format` export `serializeMomentariseDocument(parseResult): SerializeResult`: model-tree → Markdown for the V0 set (heading via `attributes.depth`, paragraph, blockquote, list via `ordered`/`start`/`checked`, codeFence via `language`/`meta`/`value`, thematicBreak, inline text/emphasis/strong/strikethrough/inlineCode/link/image/break via attributes, opaque nodes raw). `md-rich-prosemirror` gains `proseMirrorDocToMomentariseNodes(doc)` and routes its RECONSTRUCTED-block path through the md-format serializer; the byte-preserving fast path in `serializeRichMarkdownContent` (expected-pairs matching) stays exactly as is. Hard constraints: `tests/rich-roundtrip-fidelity.test.mjs` green unchanged; the exact-string expectations in `tests/rich-commands.test.mjs` (e.g. ```` "```ts\nconst value = 1;\n```" ````, `"- [ ] Task body"`, `"> [!NOTE] Remember this"`) pass unchanged.
3. Hash unification. Move the fnv1a-64 `hashMarkdownContent` from `packages/md-save/src/index.ts` into `@momentarise/md-core` (pure function, no imports — allowed in core); `md-save` re-exports it under the same name (compat); `md-format` deletes its 32-bit `hashContent` and uses the shared one. Safe because all tests compare content strings, not hash values, and the demo's `shortHash` already strips the `fnv1a64:` prefix.
4. Branding + metadata. `md-core`: change `NodeId` to `Brand<string, "NodeId">` (drop the `| string` escape) and export `nodeId(value: string): NodeId`; fix assignments in `md-format` (`ast-N`, `opaque-N`, `root`) and any rich block records. Every package.json gains `repository`, `engines: { "node": ">=20" }`, and `keywords`. Internal `"0.0.0"` version pins stay until MME-0036 introduces changesets — note this explicitly in the build log.

Consumer smoke harness (`scripts/consumer-smoke.mjs`, wired as `test:consumer-smoke`, NOT added to default `npm test`): `npm pack` every package into a temp dir; scaffold/copy a minimal Vite vanilla-TS consumer; install the tarballs; run `tsc --noEmit` + `vite build`; repeat install with `npx pnpm install --strict-peer-deps` (catches phantom deps); run the duplicate-instance check. Support `MME_SMOKE_OFFLINE=1` to skip registry-dependent scaffolding using a pre-committed consumer under `examples/`.

Pitfall: after the peer-deps move, a plain `npm install` at the root may prune hoisted packages — run a full `npm install && npm test` before declaring done.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because dependency policy is an architecture decision.

### Reviewer

Architecture Reviewer and DX Reviewer.

## MME-0025 — Theming contracts: tokens, host theme, icon set

### Status

Completed 2026-06-25; human accepted the default theming/icon direction, dark/light visual proof, host theme override proof, and the documented CSS-only compatibility-token follow-up. Commit and push are authorized before moving to `MME-0026`.

### Goal

Establish layer 1 and 2 of the theming/settings separation: framework design tokens and the host theme contract, framework-agnostic and DOM-free at the contract level.

### Scope

- `@momentarise/md-theme`: typed token definitions (`--mme-*` CSS custom properties) for color roles, typography, font scale, line height, radius, spacing/density, shadows, z-layers; light and dark schemes; `tokens.css` artifact.
- Typed `MmeTheme` deep-partial host theme object resolved to token values; per-component class-map escape hatch; documented plain-CSS override as last resort.
- `IconSet` contract (icon name to SVG factory, framework-free) plus a default icon set.
- Demo styles migrate to tokens for colors/typography/spacing (full polish is MME-0030).

### Acceptance criteria

- Theme/token/icon types live in a DOM-free module covered by the architecture gate; only the CSS artifact and default icons are presentation assets.
- A host can pass a partial `MmeTheme` and see colors, typography, font scale, radius, and density change without forking CSS.
- Dark/light switching works through tokens alone.
- Icon set is replaceable by the host; default set renders in the demo toolbar.
- No surface component uses a hardcoded color/font/spacing value after migration.
- Visual impact: demo visuals re-based on tokens; screenshots captured under `docs/internal/visual-checks/MME-0025/`.

### Implementation notes

New package `packages/md-theme`. The contract module (types + resolver) is DOM-free and joins `tests/no-host-imports.mjs` `checkedSourceRoots`; only `tokens.css` and the default icon SVG strings are presentation assets.

Prescriptive token set (CSS custom properties; implement exactly these names, extend only with reviewer agreement):
colors `--mme-color-bg`, `--mme-color-surface`, `--mme-color-surface-raised`, `--mme-color-border`, `--mme-color-text`, `--mme-color-text-muted`, `--mme-color-accent`, `--mme-color-accent-contrast`, `--mme-color-danger`, `--mme-color-selection`, `--mme-color-focus-ring`; typography `--mme-font-family-ui`, `--mme-font-family-content`, `--mme-font-family-mono`, `--mme-font-size-base`, `--mme-font-scale`, `--mme-line-height`; shape `--mme-radius-sm|md|lg`; spacing `--mme-space-1..6` (4px scale) and `--mme-density` (multiplier applied to paddings); elevation `--mme-shadow-sm|md`; layers `--mme-z-toolbar|menu|overlay`. Light and dark schemes are two value sets for the same names (`[data-mme-scheme="dark"]`).

API sketch:

```ts
export type MmeScheme = "light" | "dark";
export interface MmeTheme { /* deep-partial groups mirroring the token names: colors, typography, shape, spacing, elevation */ }
export function resolveThemeToCssVariables(theme: MmeTheme, scheme: MmeScheme): Readonly<Record<string, string>>;
export type IconName = "bold" | "italic" | "code" | "list" | "todo" | "quote" | "heading" | "link" | "image" | "divider" | "ai" | "more" | "chevron" | "check" | "close" | "search" | "save";
export interface IconSet { render(name: IconName): string; } // returns SVG markup, stroke currentColor, 16px grid
export const defaultIconSet: IconSet; // hand-drawn, license-clean, no external assets
export interface ComponentClassOverrides { readonly [componentKey: string]: string; } // Lexical-style escape hatch
```

Applying variables to an element (`element.style.setProperty`) is host/demo code, NOT in the contract module.

Seed already exists: MME-0039 created the draft token NAMES and VALUES (Vercel-docs aesthetic, default dark + light) in `apps/md-demo/src/styles.css` `:root` / `:root[data-mme-scheme="light"]`. Lift them verbatim into `tokens.css` and `DEFAULT_MME_THEME`; the demo already consumes only `var(--mme-*)`, so its migration is mostly deleting the local `:root` block and importing the package one (keep the `--line`/`--font-mono` aliases until the CodeMirror package theme is migrated). The default scheme is dark.

Also migrate `@momentarise/md-source-codemirror`'s default theme: replace the `--line`/`--font-mono` alias usage with `--mme-*` tokens AND add a dark `HighlightStyle` (the MME-0039 demo only set a legible CM base via CSS; Markdown syntax tokens still use the light `defaultHighlightStyle`). This is the package half of the theming work.

RED first: a static test asserting `styles.css`/`tokens.css` contain no raw hex colors outside the token blocks, plus unit tests for `resolveThemeToCssVariables` merge precedence (host partial over defaults, scheme switching).

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, UX Reviewer, and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this sets the public theming direction.

### Reviewer

Architecture Reviewer and UX Reviewer.

## MME-0026 — Preferences, settings locks, and capability contracts

Completed 2026-06-26. Added the headless `@momentarise/md-editor` preference schema/resolver, document `mme:` allowlist extraction, lock and rejection metadata, source CodeMirror Compartments, rich ProseMirror plugin reconfiguration, and a demo host-preference simulation without adding a settings page. Proven by `tests/preferences-contracts.test.mjs`, `tests/preferences-demo-baseline.test.mjs`, package reconfigure tests, full `npm test`, and `scripts/visual-check-mme0026.mjs` with artifact `docs/internal/visual-checks/MME-0026/runtime-preferences-debug.png`. `MME-0027` is unblocked after issue-scoped commit and push.

### Goal

Establish layers 3–5 of the separation: user preference contract, editor behavior preferences, and runtime capability flags — with host-controlled exposure and locking. MME must not assume it owns any settings UI.

### Scope

- Declarative `PreferenceSchema`: key, type, default, scope (`host`/`workspace`/`document`/`user`), constraints, i18n label key.
- Pure resolution pipeline: framework defaults → host defaults → workspace → document (allowlisted safe subset via optional frontmatter) → user; locks (`locked: { value, reason }`) and a host-declared `userVisible` allowlist.
- Behavior preference keys covering at least: toolbar mode/style, slash menu behavior, command palette behavior, block affordances, AI entry points, mode switcher style, status/save UI, folding UI, code block UI, layout density and breakpoints, keymap profile with per-command rebinds and a `delegateToHost` mode for IDE hosts, readable line width, font scale, autosave interval.
- Capability flags (facts, not choices): file system access, AI provider present, touch device, viewport class, offline.
- Runtime reconfiguration: CodeMirror `Compartment`s and ProseMirror plugin reconfigure so preference changes apply live without editor teardown.
- Replaces `resolveReferenceEditorPreferences`; demo proves host override, lock, allowlist subset, and live apply.

### Acceptance criteria

- Schema and resolver are headless, host-independent, and fully unit-tested including lock and allowlist semantics.
- MME ships no settings page; the demo simulates a host exposing a limited subset.
- A locked preference cannot be changed by user-scope input and reports its lock reason.
- Changing theme, density, toolbar mode, and keymap at runtime applies live in source and rich modes.
- Settings locks remain distinct from `md-policy` document capabilities, with consistent decision-metadata style.
- Visual impact: demo gains a debug-level host-preference simulation; no end-user settings UI is added.

### Implementation notes

The preference machinery lives in `@momentarise/md-editor` (headless). Contract sketch:

```ts
export type PreferenceScope = "host" | "workspace" | "document" | "user";
export interface PreferenceDefinition {
  readonly key: string;                       // e.g. "toolbar.mode"
  readonly type: "boolean" | "enum" | "number" | "string";
  readonly default: unknown;
  readonly scopes: readonly PreferenceScope[];
  readonly enumValues?: readonly string[];
  readonly min?: number; readonly max?: number;
  readonly labelKey: string;                  // i18n key, never a literal
}
export interface PreferenceLock { readonly value: unknown; readonly reason: string; readonly lockedBy: "host" | "workspace"; }
export interface ResolvedPreference { readonly value: unknown; readonly source: PreferenceScope | "framework"; readonly locked: boolean; readonly lockReason?: string; readonly userVisible: boolean; }
export function resolvePreferences(options: {
  schema: readonly PreferenceDefinition[];
  layers: { host?: Record<string, unknown>; workspace?: Record<string, unknown>; document?: Record<string, unknown>; user?: Record<string, unknown> };
  locks?: Record<string, PreferenceLock>;
  userVisible?: readonly string[];            // allowlist; absent key => not user-visible
}): Readonly<Record<string, ResolvedPreference>>;
```

Initial behavior keys (cover at least): `toolbar.mode`, `toolbar.style`, `slash.enabled`, `slash.groups`, `palette.enabled`, `palette.hotkey`, `blocks.dragHandle`, `blocks.plusButton`, `ai.entryPoints`, `modeSwitcher.style`, `status.disclosure`, `folding.ui`, `codeBlock.lineNumbers`, `codeBlock.languagePicker`, `layout.density`, `layout.readableLineWidth`, `keymap.profile`, `keymap.delegateToHost`, `editor.fontScale`, `save.autosaveDelayMs`, `stats.enabled`.

Resolution precedence: framework default → host → workspace → document → user; a lock at any layer freezes the value and records `lockReason`; user-layer writes to a locked or non-`userVisible` key are rejected with a structured result (mirror `PolicyDecision` metadata style: `source`, `reason`, `overridable: false` — but keep the types separate from md-policy).

Document scope: parse ONLY an allowlisted safe subset (`layout.readableLineWidth`, `stats.enabled`) from a `mme:` frontmatter object; everything else from frontmatter is ignored with a diagnostic.

Capabilities are a separate type (facts, not choices): `interface HostCapabilities { fileSystemAccess: boolean; aiProviderPresent: boolean; touchDevice: boolean; viewportClass: "mobile" | "tablet" | "desktop" | "constrained"; offline: boolean; }` — no resolution pipeline, no locks.

Runtime reconfiguration: `packages/md-source-codemirror` wraps theme/keymap/behavior in `new Compartment()` each and exposes `{ extensions, reconfigure(prefs): StateEffect[] }`; `md-rich-prosemirror` exposes a `reconfigureRichPlugins(state, prefs)` helper built on `EditorState.reconfigure`. The demo proves live apply by toggling density/toolbar mode/keymap with no editor teardown.

Migration: `apps/md-demo/src/reference-surface.ts` (`ReferenceEditorPreferences`, `resolveReferenceEditorPreferences`, `referenceAiActionsForEntryPoint`) becomes a thin adapter over the new system. CAUTION: `tests/demo-reference-surface-baseline.test.mjs` string-checks those export names — keep the names or update that test deliberately in the same slice.

RED first: unit tests for precedence, locks, allowlist, document-scope filtering, and live-reconfigure (CM Compartment swap changes behavior without recreating `EditorView`).

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, DX Reviewer, and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless lock semantics are ambiguous.

### Reviewer

Architecture Reviewer and DX Reviewer.

## MME-0027 — Extension registry V0

Completed 2026-06-30; human accepted MME-0027 after review fixes for rich code-block escape, slash query consumption/custom-block insertion, and compact toolbar labels. Added the headless `@momentarise/md-editor` extension registry, demo host registrations for slash/toolbar/custom AI/custom block, built-in command re-registration through the same public API, diagnostics for unknown/disabled ids, and MME-0027 visual proof. The accepted review fixes let double Enter / ArrowDown / ArrowRight leave a final rich code block, consume typed slash queries before slash/AI dispatch, insert the host custom block at the current rich selection with a trailing paragraph, and render the primary toolbar as compact glyph/icon buttons with hover/accessibility labels. Proven by `tests/extension-registry.test.mjs`, `tests/rich-input-rules.test.mjs`, `tests/demo-slash-toolbar-baseline.test.mjs`, full `npm test`, and `scripts/visual-check-mme0027.mjs` with artifacts under `docs/internal/visual-checks/MME-0027/`. `MME-0028` is unblocked after issue-scoped commit and push.

### Goal

Open the closed registries so hosts and third parties can extend MME without forking — the Tiptap-class adoption requirement.

### Scope

- Registration APIs on the session/surface contracts: slash items, toolbar items, AI actions, input rules, and keybindings, with namespaced string ids (`host:my-action`) replacing closed unions.
- Custom block escape hatch: a host-defined block with an explicit Markdown serialization contract (fenced directive, raw HTML, or opaque passthrough) that round-trips through the fidelity gate.
- AI actions gain a parameter schema (enum/free-text) so actions like tone or translate are parameterizable.

### Acceptance criteria

- The demo registers a custom slash command, a custom toolbar item, and a parameterized custom AI action from host code without modifying MME packages.
- A custom block serializes to valid Markdown per its declared contract and survives round-trip untouched.
- Built-in commands are re-registered through the same API (no privileged path).
- Unknown/disabled extension ids fail safely with diagnostics, not crashes.
- Visual impact: demo shows host-registered entries in slash menu and toolbar; screenshots under `docs/internal/visual-checks/MME-0027/`.

### Implementation notes

Registries live on the session (`@momentarise/md-editor`); the rich package keeps `richCommandRegistry` for built-ins but the session re-registers every built-in through the SAME public call (acceptance requires no privileged path). Ids are namespaced strings: built-ins `mme:heading1`, host items `host:my-action` — replace closed unions (`RichCommandId`, `ReferenceAiActionId`) at the registry boundary with `string` while keeping the union types for built-in definitions.

```ts
export interface SlashItemDefinition {
  readonly id: string; readonly labelKey: string; readonly aliases: readonly string[];
  readonly group: "blocks" | "lists" | "insert" | "ai" | string;
  run(context: { session: MarkdownEditorSession }): void | Promise<void>;
}
export interface ToolbarItemDefinition { readonly id: string; readonly labelKey: string; readonly icon: IconName | string; readonly group: string; run(context): void; isActive?(context): boolean; }
export interface AiActionParam { readonly name: string; readonly type: "enum" | "text"; readonly values?: readonly string[]; readonly labelKey: string; }
export interface AiActionDefinition { readonly id: string; readonly labelKey: string; readonly params?: readonly AiActionParam[]; readonly demoAction: AiWritingAction; buildPrompt(params: Record<string, string>): string; }
export interface CustomBlockDefinition {
  readonly id: string;
  readonly persistence: "fenced-directive" | "raw-html" | "opaque-passthrough";
  matches(node: MomentariseNode): boolean;   // recognize on parse
  serialize(data: unknown): string;          // MUST round-trip byte-identically through the fidelity gate
}
registerSlashItem(def) / registerToolbarItem(def) / registerAiAction(def) / registerKeybinding({ keys, commandId }) / registerCustomBlock(def)
```

Parameterized AI: `tone` and `translate` from `apps/md-demo/src/reference-surface.ts` `REFERENCE_AI_ACTIONS` become the first parameterized actions (enum tone values; free-text target language) — the surface renders a parameter prompt before dispatch.

Custom block escape hatch V0: a registered block persists as a fenced directive `:::<id> ... :::` (already detected as opaque "unknown extension syntax" by `detectOpaqueNodes` in `packages/md-format/src/index.ts`) — so round-trip safety comes free IF serialization emits exactly that shape. RED test: register a sample block from "host" code in the demo, insert it, serialize, reparse, assert byte-identity via the fidelity-gate machinery; also register a slash item and toolbar item without touching any `packages/` file.

Failure safety: dispatch of an unknown/disabled id returns a structured `{ handled: false, diagnostic }` and logs a diagnostic — never throws to the view layer; duplicate id registration throws synchronously at registration time (developer error, fail fast).

Pitfall: keyboard shortcuts registered here must flow through the MME-0026 keymap profile (`keymap.delegateToHost` mode disables them), not directly into CM/PM keymaps.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, DX Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is public extension API.

### Reviewer

Architecture Reviewer and DX Reviewer.

## MME-0028 — Editor surface package with i18n and accessibility

Completed 2026-06-30; human waived code HITL after subagent reviewer fixes and accepted continuing because Andrew does not need to personally review TypeScript code. Added publishable `@momentarise/md-surface`, extracted toolbar/slash menu/command palette/document status/AI assistant/mode control/diagnostics into framework-free DOM components, wired the demo as composition, added jsdom behavior tests and MME-0028 visual proof, fixed reviewer-blocked command-palette focus return, localized extension labels through `MmeStrings.extensions`, and documented the trusted `IconSet.render()` HTML boundary. Detailed UX interaction feedback is deferred to later follow-ups. Proven by `npm run test:surface`, `npm run test:demo-reference-surface`, `npm run test:theme`, `npm run build:demo`, `MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0028`, full `npm test`, and `git diff --check`. `MME-0028.5` is unblocked after issue-scoped commit.

### Goal

Extract the reference surface out of the demo into `@momentarise/md-surface`: framework-free DOM components consuming tokens, preferences, icons, and an i18n dictionary.

### Scope

- Move toolbar, slash menu, command palette, document status popover, AI panel, mode control, and diagnostics surface out of `apps/md-demo/src/main.ts` into reusable components.
- Components consume only: session events/commands, tokens, preference values, `IconSet`, and an injected string dictionary (default English shipped; no hardcoded literals).
- Accessibility baseline: focus trap in palette/menus, roving tabindex, aria roles/labels, keyboard-complete operation, visible focus.
- Replace string-contains demo baseline tests with DOM behavior tests for the extracted components.
- Demo becomes a thin composition of session + views + surface.

### Acceptance criteria

- `apps/md-demo/src/main.ts` shrinks to composition/wiring; no surface component logic remains in the app.
- Surface package has no React/Theia/host imports and no hardcoded strings, colors, or shortcuts.
- Behavior tests cover slash keyboard flow, palette open/navigate/execute, toolbar command dispatch, AI entry-point gating by preferences.
- Keyboard-only operation works for every surface control; aria audit documented.
- Visual impact: equivalent UI from extracted components; screenshots under `docs/internal/visual-checks/MME-0028/`.

### Implementation notes

What to extract from `apps/md-demo/src/main.ts` into `packages/md-surface` (locate by function name; line numbers will have drifted): the toolbar template + `richCommandToolbar` click handling and `setToolbarMoreOpen`; the slash menu (`renderSlashMenu`, `positionSlashMenu`, `handleSlashMenuKeyboard`, `detectSlashCommandState`, `closeSlashMenu`, `slashCommandSectionLabel`); the command palette (`setCommandPaletteOpen`, `renderCommandPaletteItems`, `commandPaletteActions`, `handleCommandPaletteKeyboard`); the document status popover and `renderSaveState`'s label helpers (`dirtyStateLabel`, `documentTargetLabel`, `primaryActionLabel`); the AI assistant panel (`renderAiWritingState` + the `editorAi*` handlers); the mode control; the floating diagnostics shell.

Component contract (framework-free DOM, one per component):

```ts
export interface SurfaceComponentContext {
  readonly host: HTMLElement;                 // mount point, injected
  readonly session: MarkdownEditorSession;    // events + commands, never global state
  readonly preferences: ResolvedPreferences;
  readonly icons: IconSet;
  readonly strings: MmeStrings;               // i18n dictionary, default English exported
}
export function createToolbar(context: SurfaceComponentContext): { update(): void; destroy(): void };
```

Rules: no `document.querySelector` outside the injected host; no string literal rendered without `strings[key]`; no style values outside tokens; components subscribe to session events and unsubscribe in `destroy()`.

Accessibility checklist (per component, document the audit in the visual-checks README): palette = `role="dialog"` + focus trap + `aria-activedescendant` listbox + Escape returns focus; slash menu = listbox with roving selection (already keyboard-navigable — preserve `handleSlashMenuKeyboard` behavior exactly, it is covered by demo tests); toolbar = `role="toolbar"` with arrow-key roving tabindex; status popover = disclosure pattern (`aria-expanded`); AI panel buttons keep their existing test ids.

Testing: jsdom DOM behavior tests (jsdom introduced by MME-0022) replace the string-contains checks for extracted parts. List every demo-* baseline test you deliberately update (`tests/demo-slash-toolbar-baseline.test.mjs`, `tests/demo-reference-surface-baseline.test.mjs`, `tests/demo-ai-writing-baseline.test.mjs`, ...) in the build log with one-line justifications — Gate 0.7 requires evidence, not silent rewrites.

Pitfall: keep all `data-testid` attributes stable; `scripts/visual-check-mme0018.mjs` and `scripts/visual-check-mme0019.mjs` depend on them and must still pass.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer, Architecture Reviewer, Test Reviewer, and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the reusable product surface.

### Reviewer

UX Reviewer and Architecture Reviewer.

## MME-0028.5 — Inline AI prompt surface and usable writing flow

Completed 2026-06-30; code HITL remained waived by the human for TypeScript/package work, and UX/security subagent reviewers accepted after fixes. Added reusable `createInlineAiPrompt` to `@momentarise/md-surface`, routed `/ai`, slash AI, toolbar AI, and command-palette AI into one inline prompt/review model, made mock/missing/host/disabled provider states explicit, kept generated content staged with accept/reject through the existing `MME-0023` hash/session contract, and removed misleading user-facing BYOK wording from the demo. Reviewer fixes added whole-dialog Escape handling, focus-preserving action-row keyboard navigation, keyboard-driven visual proof, and provider-truth wording. Proven by `npm run test:surface`, `npm run test:demo-ai-writing`, `npm run build:demo`, `npm run visual:mme-0028.5`, full `npm test`, and `git diff --check`. `MME-0028.6` is the next candidate after issue-scoped commit, but it defines real provider/key-handling boundaries and keeps its own security/architecture review gate.

### Goal

Make AI writing usable as an editor-native interaction, not a debug/demo panel. The reference behavior is BlockNote/Copilot/Gemini-style: `/ai` opens an inline prompt under the current block, the prompt is focused, suggested actions are directly selectable, and every generated change remains explicit review/apply.

### Scope

- Add an inline AI prompt surface anchored to the current block/line when the user selects AI from the slash menu or types `/ai`.
- Prompt surface structure: focused free-text input/textarea first; action rows/buttons below for continue writing, draft/insert, rewrite, improve, summarize, tone, explain, translate, checklist, and table where supported.
- Keep toolbar, command palette, and future selection/bubble toolbar AI entry points routing into the same prompt/review model.
- Make provider state explicit: mock/offline demo, host-managed provider, disabled by policy, or missing provider. Do not imply that random OpenAI/Gemini/Mistral keys work unless a real provider adapter is configured.
- Keep AI assistive and policy-gated: generated content is staged, visibly reviewed, accepted/rejected, and stale suggestions are refused through the `MME-0023` hash contract.

### Acceptance criteria

- `/ai` or slash-menu AI opens a panel positioned under the current rich block/line, not a topbar/global debug panel.
- Prompt input is focused by default and accepts arbitrary user text.
- Built-in AI action rows are visible and keyboard navigable below the prompt.
- Enter/Cmd-Enter behavior is documented and tested; Escape closes and returns focus to the editor.
- Choosing an action or submitting a prompt creates a staged suggestion with accept/reject controls.
- Missing provider/session state is explicit and truthful; the UI does not claim that raw OpenAI/Gemini/Mistral keys work in the demo.
- Policy denial blocks the provider call before document content leaves the editor.
- Visual impact: major editing-surface AI interaction change; screenshots under `docs/internal/visual-checks/MME-0028.5/`.

### Test-first plan

- RED: DOM behavior test for the extracted `md-surface` AI prompt component: open from slash AI, assert focused prompt, action list, keyboard navigation, Escape focus return.
- RED: browser visual script proving `/ai` anchors under the current block/line and does not move the document layout.
- RED: provider-state test proving mock/missing/host-provider labels are explicit and provider keys are not implied to work without an adapter.

### Manual verification

Required.

Manual UI scenario:

- rich mode, place caret in an empty paragraph, type `/ai`, select AI;
- verify inline panel appears under the line with prompt focused;
- type a custom prompt;
- choose `Continue writing`;
- verify staged suggestion appears with accept/reject;
- reject and confirm Markdown is unchanged;
- repeat with missing provider/session and confirm the message is truthful.

### Dependencies

- Depends on `MME-0023` session AI orchestration and stale suggestion guard.
- Should run after `MME-0028` so the AI prompt is a reusable `@momentarise/md-surface` component rather than more demo-only code.
- Coordinates with `MME-0027` extension registry for parameterized AI actions.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer, Test Reviewer, Architecture Reviewer, and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the first usable AI writing interaction.

### Reviewer

UX Reviewer and Security Reviewer.

## MME-0028.6 — Real AI provider adapter path

Completed 2026-06-30; code HITL remained waived for TypeScript/package work, and security/architecture subagent reviewers accepted after fixes. Added `@momentarise/md-ai` OpenAI-compatible provider adapter contracts with injected host transport, response mapping to the existing staged `AiWritingSuggestion` model, no SDK/browser dependency in core, and policy-before-provider tests. The demo now supports mock/default, host-managed, local-gateway/sidecar, and personal BYOK provider states; personal BYOK stays memory-only, provider endpoints are redacted before UI/test/visual state, and visual proof covers default mock, host-managed, personal BYOK staged suggestion, and policy-blocked no-call behavior. Proven by `npm run test:ai-writing`, `npm run test:editor-session`, `npm run test:demo-ai-writing`, `npm run test:architecture`, `npm run test:publishability`, `npm run build:demo`, `npm run visual:mme-0028.6`, full `npm test`, and `git diff --check`. `MME-0029` is the next candidate after issue-scoped commit.

### Goal

Make the AI flow actually usable with a real provider when a host chooses to configure one, without putting provider SDKs or raw production key handling into MME core.

### Scope

- Add an optional host-side AI provider adapter path compatible with OpenAI-style chat/completions APIs and LiteLLM-routed providers.
- Document and prove provider state: mock demo, missing provider, host-managed backend, sidecar/local gateway, or direct personal BYOK mode.
- Keep `@momentarise/md-ai` as a provider contract package; no OpenAI, Gemini, Mistral, Anthropic, LiteLLM, Vercel AI SDK, browser-only fetch assumptions, or provider SDK dependency in core.
- Provide a demo/dev configuration path that can route to a host endpoint or local LiteLLM/OpenAI-compatible endpoint without logging or persisting keys.
- Keep production guidance explicit: recommended production path is host backend/sidecar/secure storage/user gateway, not direct browser key exposure by default.

### Acceptance criteria

- A real provider can be used in a local/dev demo through an explicit host/provider adapter configuration.
- The default demo still uses mock AI unless a provider adapter is configured.
- Provider UI clearly says whether AI is mock, missing, host-managed, local gateway, or personal BYOK.
- OpenAI-compatible/LiteLLM response mapping returns the same `AiWritingSuggestion` shape consumed by `MME-0028.5`.
- Policy checks still run before any document content reaches the provider.
- BYOK/personal key handling is memory-only in browser demo mode and never logged or persisted.
- Tests prove provider request mapping, policy-denied no-call behavior, missing-provider truthful state, and key non-leakage.
- Visual impact: provider-state label/config surface only; screenshots under `docs/internal/visual-checks/MME-0028.6/`.

### Test-first plan

- RED: contract test using a fake OpenAI-compatible HTTP endpoint adapter that records requests and returns a fixture response.
- RED: policy-denial test proving the fake endpoint is not called.
- RED: key-handling test proving no configured key appears in logs, session snapshots, visual-check state, or provider-observable payload metadata.
- RED: demo/provider-state test proving mock/missing/configured labels are truthful.

### Dependencies

- Depends on `MME-0023` session/provider contract.
- Should run after `MME-0028.5` so the real provider feeds an already usable `/ai` interaction instead of a debug surface.
- Coordinates with `MME-0036` security pass for final BYOK/security docs.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Security Reviewer, DX Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this defines real AI provider and key-handling boundaries.

### Reviewer

Security Reviewer and Architecture Reviewer.

## MME-0029 — Block interaction affordances

Completed 2026-06-30; code HITL remained waived for TypeScript/package work, and UX/test subagent reviewers accepted after fixes. Added reusable rich block-affordance contracts in `@momentarise/md-rich-prosemirror`, a host-injected decoration adapter boundary so `prosemirror-view` stays host-owned, state-level top-level block reorder helpers, and an order-aware unconsumed-pair matcher that preserves moved raw bytes for rich-compatible blocks such as setext headings and `*` list markers. The demo now wires keyboard-reachable block handles, insert-after, ARIA menu keyboard navigation, plugin drop-path reorder, localized empty-placeholder text, and a contextual selected-text bubble toolbar with AI gating through both entry-point and command-group preferences. Proven by `tests/rich-targeted-serialization.test.mjs`, `tests/demo-rich-ux-baseline.test.mjs`, `scripts/visual-check-mme0029.mjs`, full `npm test`, and visual artifacts under `docs/internal/visual-checks/MME-0029/`. `MME-0030` is the next candidate after issue-scoped commit.

### Goal

Deliver the signature block-editor interactions benchmarked against BlockNote/Notion: block side menu, drag handle, insert handle, and a contextual selection toolbar.

### Scope

- Hover-revealed block handle ("+" insert and drag grip) for top-level blocks in rich mode.
- Drag-and-drop block reordering that serializes through targeted edits (MME-0020) without rewriting unrelated source.
- Contextual selection (bubble) toolbar for inline formatting and selected-text AI, replacing the static topbar "Ask AI" placement.
- Placeholder text ("Type / for commands") and empty-document state.

### Acceptance criteria

- Block handle appears on hover/focus, supports insert-after and drag-reorder, and is keyboard-accessible.
- Reordering two blocks changes only those blocks' positions in the Markdown source.
- Selection toolbar appears on text selection in rich mode with formatting and AI actions, honoring preference gating.
- Placeholders/empty states render per preferences.
- Fidelity and targeted-serialization suites pass after drag operations.
- Visual impact: major editing-surface change; screenshots under `docs/internal/visual-checks/MME-0029/`.

### Implementation notes

BLOCKER TO CLEAR FIRST (carried from the MME-0019 review): `serializeRichMarkdownContent` in `packages/md-rich-prosemirror/src/index.ts` matches blocks SEQUENTIALLY (`pointer` only moves forward), so reordered blocks stop matching and lose raw preservation. Before any drag feature: make the matcher order-aware — search ALL unconsumed entries (a consumed-index `Set`, not a forward pointer); when a match is out of original order, emit the block's raw bytes with a normalized `"\n\n"` separator instead of an original gap. RED test: swap two blocks of `fixtures/014-mixed-real-world` via transactions and assert each block's bytes survive verbatim with single blank-line separators.

Block handle: a ProseMirror plugin adding `Decoration.widget` at each top-level block start (reuse the widget pattern from `createRichFoldingDecorations`/`createRichFoldToggleButton` in `apps/md-demo/src/main.ts` — fold toggles already prove the approach). Hover-reveal via CSS on the widget, but the handle must ALSO be reachable by keyboard: a focusable button per block; Enter opens the block menu (insert-after, duplicate-as-raw, delete, drag instructions).

Drag-reorder: on dragstart set a `NodeSelection` on the block; on drop compute the target with `view.posAtCoords`, then a single transaction `tr.delete(from, to).insert(mappedInsertPos, node)` (map the insert position through the deletion). Test reorder at state level (transactions), not with synthetic mouse events.

Selection (bubble) toolbar: listen to selection changes; position via `view.coordsAtPos(selection.from)` using the same clamping math as `positionSlashMenu`; contents = inline marks + selected-text AI honoring `referenceAiActionsForEntryPoint`/preference gating; replaces the static topbar "Ask AI" placement (`selected-text-ai-action` moves into the bubble — update the visual scripts' interaction path deliberately).

Placeholder/empty state: plugin decoration `data-placeholder` on the empty first paragraph + CSS `:before` content from the i18n dictionary; preference-gated (`blocks.plusButton`, `slash.enabled` hints).

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is signature block UX.

### Reviewer

UX Reviewer.

## MME-0030 — Beautiful default theme V1

### Status

Completed 2026-06-30; human accepted the default color/theme direction for continuation, with broader UX refinements still expected in later slices.

### Goal

Ship default light and dark themes good enough for the public demo and framework website. Host theming is not an excuse for an ugly default.

### Scope

- Tasteful typography, polished spacing/density, serious editor feel.
- Non-cheap toolbar, slash menu, command palette, status, and block affordances, including premium todo checkboxes.
- Accessible contrast (WCAG AA), coherent icon usage, responsive quality at mobile/tablet/desktop/IDE-pane widths.
- Side-by-side benchmark review against BlockNote, Notion, and Obsidian screenshots.

### Acceptance criteria

- Both schemes implemented purely through MME-0025 tokens.
- Contrast audit passes WCAG AA for text and interactive states.
- Responsive screenshots at mobile/tablet/desktop/constrained-IDE widths captured under `docs/internal/visual-checks/MME-0030/`.
- Benchmark comparison documented; UX reviewer verdict recorded.
- No hardcoded style values introduced outside tokens.
- Visual impact: major; this is the public face of the framework.

### Implementation notes

Pure design work over the MME-0025 token system: this issue changes `tokens.css` values and `packages/md-surface` component CSS only — zero new TypeScript behavior. If a design need cannot be expressed through tokens, extend the token set in md-theme first (with reviewer agreement), never inline values.

Contrast audit is automated, not eyeballed: `tests/theme-contrast.test.mjs` computes WCAG relative-luminance ratios for the token pairs (text/bg, text-muted/bg, accent-contrast/accent, focus-ring/surface) in BOTH schemes and asserts >= 4.5:1 for text, >= 3:1 for UI affordances.

Capture protocol: reuse the device-metrics pattern from `scripts/visual-check-mme0018.mjs` (the `Emulation.setDeviceMetricsOverride` blocks for 390px/768px/640px) and capture every scenario in light AND dark scheme. The benchmark comparison is a written document (`docs/internal/visual-checks/MME-0030/README.md`) referencing BlockNote/Notion/Obsidian as visual references only — never copy assets or CSS (license boundary, see MME-0018 reference boundaries).

Specific cheap-feel items called out by earlier reviews to fix here: text-label toolbar buttons ("H1", "B", "I") become icon buttons via the `IconSet`; todo checkboxes get the premium treatment required by the PRD ("premium checkbox/todo affordances, not raw cheap-looking square controls"); slash/palette items get icon + label + alias hint alignment; the `unsupported_block` raw rendering gets a quiet "preserved Markdown" affordance instead of a bare `pre`.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, mandatory visual acceptance.

### Reviewer

UX Reviewer.

## MME-0031 — React binding and external consumer validation

### Goal

Provide `@momentarise/md-react` as a thin binding over the headless session and surface, and prove the packages work in real external consumer apps. The architecture must remain vanilla-first; React is a binding, not a foundation.

### Scope

- `useMarkdownEditor()` hook and a `<MarkdownEditor/>` component wrapping session + views + surface; Next.js App Router guidance (`"use client"` boundary, dynamic import recipe).
- Repeatable consumer smoke harness using packed tarballs: Vite vanilla TS, Next.js App Router, pnpm strict install, TypeScript `bundler` and `node16` resolution, duplicate CM/PM instance check, tree-shaking check (importing `md-format` must not pull ProseMirror).

### Acceptance criteria

- React binding contains no editor logic beyond lifecycle/binding glue.
- All consumer matrix runs pass from `npm pack` artifacts, not workspace links.
- Next.js build passes with SSR-safe imports (no DOM access at import time anywhere in published packages).
- Harness is a single documented command, runnable by CI later.
- Visual impact: no MME UI change; new example apps render the editor.

### Implementation notes

`packages/md-react`: `react` is a PEER dependency (`>=18`), never a direct one. The binding contains lifecycle glue only:

```tsx
export function useMarkdownEditor(options: MarkdownEditorSessionOptions & { theme?: MmeTheme }): {
  session: MarkdownEditorSession;
  containerRef: (element: HTMLElement | null) => void;  // mounts views + surface on attach
  state: { mode: EditorMode; saveState: SaveState };     // re-rendered via session events
};
export function MarkdownEditor(props: { options; onChange?; className? }): JSX.Element; // thin wrapper over the hook
```

No editor logic in the package — if a feature needs more than subscribe/mount/unmount, it belongs in md-editor or md-surface. SSR safety: no DOM access at module top level anywhere (import-time test in the harness); document the Next.js App Router recipe (`"use client"` component + `next/dynamic` with `ssr: false` fallback) in the package README.

Consumer matrix (extends `scripts/consumer-smoke.mjs` from MME-0024): [vite-vanilla-ts, next-app-router] x [npm, pnpm --strict-peer-deps]; a type-check consumer compiled under BOTH `moduleResolution: "bundler"` and `"node16"`, WITHOUT `exactOptionalPropertyTypes` (our packages use it; consumers will not — this catches optional-property type leaks); the duplicate-instance check (`npm ls @codemirror/state @codemirror/view prosemirror-model prosemirror-state prosemirror-view` → exactly one version each); the tree-shake check (a consumer importing ONLY `@momentarise/md-format`, build output must not contain the string `prosemirror`).

Everything installs from `npm pack` tarballs — never workspace links. One command: `npm run test:consumer-matrix`; each leg skippable via env for offline runs, with skips reported loudly.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: DX Reviewer and Architecture Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless binding API shape is contentious.

### Reviewer

DX Reviewer.

Completed 2026-06-30; code HITL remained waived for TypeScript/package work, and DX/architecture subagent reviewers accepted after fixes. Added `@momentarise/md-react` with `useMarkdownEditor()` and `<MarkdownEditor/>` lifecycle glue, kept React as a peer dependency, moved reusable presentation derivation into `@momentarise/md-surface`, added a CodeMirror source-view mount helper to `@momentarise/md-source-codemirror`, and documented the Next App Router client-boundary recipe. Extended the packed consumer matrix to cover Vite vanilla TS and Next App Router across npm and pnpm strict installs, import-time DOM safety, dual TypeScript `bundler`/`node16` resolution without consumer `exactOptionalPropertyTypes`, widened duplicate CodeMirror/ProseMirror singleton checks, an md-format tree-shake check, and loud offline skip mode. Proven by `npm run test:consumer-matrix`, `MME_CONSUMER_MATRIX_OFFLINE=1 npm run test:consumer-matrix`, `npm run test:contracts`, `npm run test:architecture`, `npm run test:source-codemirror`, `npm run test:publishability`, full `npm test`, and `git diff --check`. `MME-0032` is the next candidate after issue-scoped commit.

## MME-0032 — Markdown HTML renderer and inline-HTML policy

Completed 2026-06-30; visual proof regenerated 2026-07-01 with system Chrome permission after fixing stripped unsafe images to render as visible alt text instead of broken image placeholders.

### Goal

Add the missing render pipeline: `@momentarise/md-render-html` for read-only rendering, print/export, server/static rendering, and the future docs site — with an explicit policy for HTML inside Markdown.

### Scope

- Safe, sanitized Markdown-to-HTML renderer running in Node and browser, themable via MME tokens.
- Clarify and implement the three HTML cases: inline HTML in Markdown, block HTML in Markdown, and standalone `.html` artifacts. The first two are preservation-first in source and sanitized at render; the third remains the sandboxed artifact preview.
- Sanitization allowlist with diagnostics for stripped content at render time; raw source never modified; source mode remains the fallback.
- Review the artifact preview's default sandbox tokens (drop `allow-same-origin` unless concretely required).

### Acceptance criteria

- Renderer produces sanitized HTML for the full fixture corpus without throwing; unknown syntax renders as visible raw/opaque, not dropped.
- Script/iframe/event-handler content in Markdown HTML never executes in rendered output; tests prove it.
- Rendering never mutates the persisted Markdown; preservation suites unaffected.
- Node-side render works headlessly (no DOM dependency) for SSR/static use.
- PRD HTML clarification landed (three cases distinguished).
- Visual impact: demo gains a read-only rendered view entry point; screenshots under `docs/internal/visual-checks/MME-0032/`.

### Implementation notes

The PRD section "HTML inside Markdown vs HTML artifacts" already defines the three cases — implement, do not re-litigate.

Pipeline recommendation for `packages/md-render-html` (all host-free, Node + browser): `unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeSanitize, mmeSchema).use(rehypeStringify)`. The sanitize schema is THE security boundary: start from `rehype-sanitize`'s GitHub default schema; remove `script`, `style`, `iframe`, all `on*` attributes; keep `class` for token-based styling; allow `input[type=checkbox][disabled]` for task lists; document every divergence from the default schema in the package README. The renderer must also surface MME opaque content visibly (callouts/wikilinks/math render as literal text or a marked `<span data-mme-opaque>` — never dropped).

Stripped-content diagnostics: render twice (pre-sanitize tree vs post-sanitize tree), diff element/attribute counts, and emit `render_html_stripped` diagnostics with what was removed — diagnostics describe the RENDER ARTIFACT only; the Markdown source is never mutated (assert in tests that input string is unchanged and that re-parsing the input after render is byte-identical).

Sandbox default flip (same slice, small): `createSandboxedHtmlPreview` in `packages/md-preview-html/src/index.ts` currently defaults `sandboxTokens` to `["allow-same-origin"]` — change the default to `[]` (nothing in the preview needs same-origin: srcdoc + scripts blocked), keep the token accepted when hosts pass it explicitly, update `tests/html-preview.test.mjs` and the demo banner/status strings, and record the security rationale in the build log.

Demo entry point: a "Read" view for markdown documents only (document-kind aware, like the existing rich/preview gating in `renderEditorMode`); the sanitized output may render inline in an `<article>` (it is sanitized) — decide iframe vs inline explicitly and document why.

Headless tests: render the full fixture corpus in Node; assert no `<script` substring in any output; assert `__MME_HTML_PREVIEW_SCRIPT_RAN__`-style probes never fire in the demo; assert unknown syntax remains visible.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Security Reviewer, Architecture Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because sanitization policy is a security boundary.

### Reviewer

Security Reviewer and Architecture Reviewer.

## MME-0033 — Find/replace and outline APIs

### Goal

Close two baseline editor expectations: document-level find/replace and a heading outline contract.

### Scope

- Session-level find/replace API working across source and rich views (CodeMirror search integration; ProseMirror decoration-based highlighting); replace flows through targeted edits.
- Outline API derived from headings (never frontmatter), exposing the hierarchy already computed by the folding machinery, consumable by host outline panels and the future docs-site right panel.

### Acceptance criteria

- Find highlights matches in both modes; replace/replace-all preserve unrelated source bytes.
- Outline API returns the heading tree with stable anchors/slugs for any Markdown document without frontmatter.
- Keyboard shortcuts respect the MME-0026 keymap contract.
- Visual impact: find UI in the surface package; screenshots under `docs/internal/visual-checks/MME-0033/`.

### Implementation notes

Both APIs live in `@momentarise/md-editor` (headless, offset-based); views render highlights.

Find: `session.find(query, { caseSensitive?, regex? }): readonly { from: number; to: number }[]` over `getContent()`. Source view: feed matches to CodeMirror via a decoration extension (or integrate `@codemirror/search`'s panel if its UI passes the surface/i18n rules). Rich view: map source offsets to PM positions — for UNTOUCHED blocks the mapping is exact via the expected-pairs ranges in `serializeRichMarkdownContent` (expose a `richPositionForSourceOffset(state, offset)` helper from md-rich-prosemirror built on those pairs); for edited blocks fall back to text search within the block and mark the result approximate.

Replace: source mode = a CodeMirror transaction over the match range; rich mode = `tr.insertText(replacement, mappedFrom, mappedTo)`; both paths then flow through `session.setContent` so the preservation suites prove unrelated bytes survive (RED test: replace one occurrence in fixture 014; assert all other lines byte-identical — same pattern as `tests/rich-targeted-serialization.test.mjs`).

Outline: `session.getOutline(): readonly OutlineItem[]` with `interface OutlineItem { depth: number; text: string; slug: string; sourceRange: SourceRange; children: readonly OutlineItem[] }`, derived from heading nodes of `getParseResult()` — never frontmatter. Reuse the slug/sibling-disambiguation logic from `richHeadingFoldNodeId`/`slugFoldIdText` in `packages/md-rich-prosemirror/src/index.ts` by MOVING the pure slug helpers into md-editor (or md-core) so the outline works headless without ProseMirror; the rich package imports them back. Slugs must be stable for duplicate headings (occurrence suffix, same scheme as the fold ids).

Keybinding `Mod-f` registers through the MME-0026/0027 keybinding registry (so IDE hosts can delegate it away), not directly in CM/PM keymaps.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no.

### Reviewer

UX Reviewer.

Completed 2026-07-01; code HITL remained waived for TypeScript/package work by current execution instruction, and code/visual reviewers accepted after fixes. Added `session.find()`, `session.replace()`, `session.replaceAll()`, `session.getOutline()`, shared heading slug helpers, source and rich find-highlight mapping, an accessible find/replace surface, `Mod-f` registry wiring, and demo visual hooks. Fixed reviewer findings by rejecting non-mappable rich source ranges instead of returning zero-length mappings, remounting rich mode after fallback targeted replacement, refreshing rich parse/source state after rich edits, and adding rich replace visual proof. Also closed the pending MME-0032 visual review by rendering stripped unsafe image URLs as alt text and regenerating visual artifacts. Proven by `npm run test:find-outline`, `npm run test:render-html`, `npm run test:rich-prosemirror`, full `npm test`, `npm run visual:mme-0032`, and `npm run visual:mme-0033`. `MME-0034` is the next candidate after issue-scoped commits.

## MME-0034 — Theia adapter alpha

Previously numbered MME-0019.

### Goal

Integrate the same core into Theia as a real adapter consuming the headless session and surface packages.

### Acceptance criteria

- Theia adapter uses the same core packages, `@momentarise/md-editor` session, and `@momentarise/md-surface` components.
- Opening `.md` works; source mode works; saving works through a Theia-backed `SaveTarget`.
- No duplicated parser/serializer/orchestration logic.
- Keybindings delegate to the Theia keybinding service per the MME-0026 `delegateToHost` mode.

### Implementation notes

Precondition check before any code: MME-0023 session and MME-0028 surface exist — the adapter is a SHELL, not a re-implementation. If you find yourself copying logic from `apps/md-demo/src/main.ts`, stop: that logic belongs in md-editor/md-surface and the demo should already consume it.

Adapter responsibilities only: (1) a Theia widget (`ReactWidget` or plain `BaseWidget` hosting the framework-free DOM surface — prefer the plain widget to prove framework independence) that mounts the session + views + surface components into the widget's node; (2) a `SaveTarget` backed by Theia's `FileService` (`write` via FileService.write, `readExternalHash` via read + `hashMarkdownContent` — the same contract `createWritableFileSaveTarget` implements in `packages/md-adapter-web/src/index.ts`, use it as the reference implementation); (3) an `OpenHandler`/editor contribution registering for `.md` URIs; (4) keybindings registered in Theia's `KeybindingRegistry` dispatching session commands, with MME's internal keymap profile set to `delegateToHost`; (5) preference bridging from Theia's `PreferenceService` into the MME-0026 host layer.

Alpha scope is deliberately small: open `.md` from the Explorer, source-mode editing, save with truthful status, dirty indicator on the tab. Rich mode must MOUNT but its polish is not gated here.

Build reality: Theia requires its own application shell — create `apps/theia-demo` (or `examples/theia`) with the standard Theia browser app skeleton consuming `@momentarise/md-adapter-theia`; document the exact build/run commands in the build log (Gate 0.8 needs a URL).

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, UX Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless adapter integration changes core boundaries.

### Reviewer

Architecture Reviewer.

Completed 2026-07-01; code HITL remained waived for TypeScript/package work by current execution instruction, and code reviewer accepted after fixes. Added `@momentarise/md-adapter-theia`, a real Theia frontend module with widget factory/OpenHandler/commands/keybindings, `SaveTarget` via Theia `FileService`, `PreferenceService` bridging, focus context key integration, find command routing to the shared MME find surface, and `apps/theia-demo` browser shell verification. Visual proof uses a demo-scoped `mme-demo:` Theia `FileService` provider to open a Markdown resource through the real OpenHandler without relying on host `file:` provider availability in the stripped demo shell. Proven by `npm run test:theia-adapter`, `npm run test:publishability`, `npm run test:architecture`, `npm run test:contracts`, full `npm test`, and `npm run visual:mme-0034`. `MME-0035` is the next candidate after issue-scoped commit.

## MME-0035 — Host adapter external-change strategy

Previously numbered MME-0020.

### Goal

Define and prove the host-adapter contract for external document changes without moving host-specific watching into the core.

This issue was added after MME-0011.5 from product discussion: local web, Theia/IDE, database-backed apps, and Chrome extensions do not observe external changes the same way.

### Scope

- Define the adapter-level contract for external changes: focus refresh, polling, host file events, realtime sync events, and save-time hash verification.
- Implement the minimal web strategy: focus-refresh re-hash for writable files in the web adapter.
- Document which strategies apply to `@momentarise/md-adapter-web`, `@momentarise/md-adapter-theia`, `@momentarise/md-adapter-vscode`, and future `@momentarise/md-adapter-chrome-extension`.
- Keep the core Save Engine responsible for hashes, dirty state, conflict state, and safe no-overwrite behavior.
- Keep host watchers, browser extension APIs, IDE file services, and database realtime subscriptions out of core packages.
- Document that adapters may register MME as the default Markdown reader/editor when the host allows it, without making the core assume default-editor ownership.

### Acceptance criteria

- PRD explains that external-change handling is adapter-owned.
- Adapter contract distinguishes local-file, IDE, database/realtime, and Chrome extension strategies.
- Web adapter implements focus refresh plus save-time verification; conflict surfaces before save when detectable.
- Theia/IDE adapters can use host file events when available.
- Database-backed hosts can use realtime server events when available.
- Chrome extension adapter is listed as a future candidate, with explicit permission/API limits.
- Default Markdown reader/editor registration is documented as adapter-owned for hosts that support it.
- Core packages still import no host-specific watcher, database, Theia, VS Code, Chrome extension, or browser-extension APIs.

### Implementation notes

The implementable part (the rest is contract documentation in the PRD): web focus-refresh in `packages/md-adapter-web`.

```ts
export interface ExternalChangeWatcher { start(): void; stop(): void; }
export function createFocusRefreshWatcher(options: {
  readonly readExternalHash: () => Promise<DocumentHash | null>;   // from the SaveTarget
  readonly getLastSavedHash: () => DocumentHash | undefined;        // from SaveEngine state
  readonly onExternalChange: (externalHash: DocumentHash) => void;  // host surfaces conflict BEFORE save
  readonly listen: (handler: () => void) => () => void;             // host wires window focus + visibilitychange; keeps the package DOM-free
}): ExternalChangeWatcher;
```

The package stays browser-API-free by taking `listen` as an injected hook; the DEMO wires `window.addEventListener("focus", ...)` and `document.visibilitychange`. On trigger: read external hash, compare to `lastSavedHash`, call `onExternalChange` on mismatch — the demo then shows the conflict state without waiting for the next save (the Save Engine's save-time verification in `runSingleFlush` remains the hard guarantee; this watcher is UX-earliness only).

Documentation deliverables: the adapter strategy matrix (local-file / IDE / database-realtime / Chrome-extension) goes into the PRD's external-change section; per-adapter strategy notes into each adapter package README when they exist.

RED test: `tests/web-external-change.test.mjs` — fake `listen` capture, simulate external change, assert `onExternalChange` fires with the new hash and that a subsequent `flush` reports `conflict` (reuse `createMemorySaveTarget().simulateExternalChange`).

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this defines adapter behavior and user trust around external edits.

### Reviewer

Architecture Reviewer.

Completed 2026-07-03; accepted for code continuation after the human-approved external-change behavior direction and reviewer fixes. Added a DOM-free `createFocusRefreshWatcher()` in `@momentarise/md-adapter-web`, optional `readExternalContent()` on `SaveTarget`s, headless session APIs for clean external apply vs dirty conflict, web/demo focus-refresh wiring, actionable conflict status actions, compact status chrome, and a stale save-state listener fix so source autosave returns the badge to clean without mode switching. Fixed reviewer findings by cancelling stale in-flight watcher callbacks across document swaps, routing watcher/read errors through `onError` and demo notices, and hiding conflict action buttons when a host provides no resolver. Proven by `npm run test:web-external-change`, `npm run test:web-file-access`, `npm run test:surface`, full `npm test`, and `npm run visual:mme-0035`.

## MME-0036 — Release engineering and security pass

### Goal

Make the repository publishable: licensing, CI, versioning, export hygiene, and a security review of public surfaces.

### Scope

- License decision (human; PRD recommends MPL-2.0 core, MIT/Apache-2.0 examples) with LICENSE files and `license` fields everywhere; per-package READMEs.
- CI pipeline running all gates plus the MME-0031 consumer matrix on pull requests.
- Versioning/release tooling (changesets or equivalent), CHANGELOG, semver and compatibility-promise documents, experimental labels per package.
- Public API export audit (no accidental exports such as test helpers); typed error taxonomy for public APIs.
- Security pass: URL sanitization for link/image attributes in the rich schema (no `javascript:` round-trip into live anchors), paste-handling policy, sandbox default review, BYOK key-handling statement, `SECURITY.md`, `CONTRIBUTING.md`.
- Repo hygiene for going public: internal docs boundary check, ignored local env files, `.learnings/` exclusion.

### Acceptance criteria

- Fresh clone CI run is green and includes pack/install consumer smoke.
- Every package has license metadata, README, version policy, and an experimental/stable label.
- Export audit documented; removed exports listed as breaking-change notes.
- Security checklist items each have a test or documented review.
- Visual impact: no visible editing or general UI changes.

### Implementation notes

Order of operations: license decision (HUMAN — stop and ask before generating files) → license files/fields → changesets → CI → export audit → security items → repo hygiene.

- License: PRD recommends MPL-2.0 for core packages, MIT or Apache-2.0 for examples/demos. After the human decides: `LICENSE` at root + per-package `license` field + per-package LICENSE files where the license differs from root.
- Changesets: `npx changeset init`; replace internal `"0.0.0"` dependency pins with real ranges managed by changesets; add `CHANGELOG.md` seeds; write the compatibility-promise document (`docs/public/`) defining what semver means per package tier and the experimental labels (per the PRD experimental list).
- CI: GitHub Actions workflow running `npm ci && npm test` plus `test:consumer-matrix` on pull requests; cache node_modules; the workflow must execute the same gates the repo enforces manually — no CI-only shortcuts.
- Export audit: a script that imports each built package and diffs `Object.keys(module)` against a committed approved-exports fixture per package (`tests/public-api-report.test.mjs`); removing the accidental exports (e.g. test helpers like `replaceFirstRichText`/`selectFirstRichText` in md-rich-prosemirror — decide keep-and-document vs remove) is a breaking-change note in the changeset.
- Security items, each with a test: (a) URL sanitization — in `packages/md-rich-prosemirror/src/index.ts`, the `link` mark and `image` node accept any href/src; add `isSafeUrl(value)` (allow `http:`, `https:`, `mailto:`, relative; reject `javascript:`, `vbscript:`, `data:` except `data:image/` for img src — document the choice) applied BOTH in `parseDOM.getAttrs` and in `inlineNodeToProseMirror`'s link/image cases; unsafe URLs render inert (href stripped, raw text preserved — never destroy the Markdown source). (b) Paste policy — PM `transformPastedHTML` hook stripping scripts/event handlers before schema parsing. (c) BYOK statement — keys memory-only, never logged/persisted (already enforced; write it down in SECURITY.md). (d) CLI surface (`@momentarise/md-cli`): `format --write` must stay explicit/opt-in (already is), `inspect`/`--json` must not leak secret-bearing file contents that policy would hard-deny, and path handling must not traverse outside the invoked tree unexpectedly — add tests. (e) `SECURITY.md` (reporting process) + `CONTRIBUTING.md` (gates summary for outside contributors).
- Continuity note: this is the consolidated audit, not the first security work — Gates 9/10/11 and MME-0032 sanitization land earlier. This issue closes the gaps they do not cover and produces the public statement.
- Repo hygiene for the public flip: confirm `docs/internal/` stays out of any publish/docs pipeline; `.learnings/`, `.env*`, `docs/internal/ai-reviews/` ignored (already in `.gitignore` — verify); delete or relocate any local credential files from the working tree.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: DX Reviewer and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because licensing is a human decision.

### Reviewer

DX Reviewer and Security Reviewer.

### Status

Completed 2026-07-03; code continuation accepted after the human license decision (`MPL-2.0` for framework packages, `Apache-2.0` for demos/examples), DX/security reviewer fixes, and final package proof. Added root/per-demo LICENSE files, package license/version/release metadata, per-package READMEs, Changesets config, CI, changelog seed, compatibility promise, public API export audit, typed error taxonomy, rich URL and paste sanitization, CLI realpath/policy hardening, `SECURITY.md`, `CONTRIBUTING.md`, and repo hygiene checks. Proven by RED release/API/security tests, `npm test`, `npm run test:consumer-matrix`, `git diff --check`, and reviewer acceptance. `MME-0037` is the next candidate after issue-scoped commit.

## MME-0037 — Public docs content baseline

### Goal

Write the public documentation as real Markdown files under `docs/public/`, readable by humans and agents, before any docs site exists.

### Scope

- Core set: overview, quickstarts (vanilla, React, Next.js, headless Node), core concepts, Markdown preservation guarantees, save truthfulness, policy, AI and privacy, theming and customization, preferences and locks, extension guide, per-package pages, FAQ, roadmap.
- Agent-readable constraints: plain CommonMark/GFM (no MDX-only constructs), stable heading anchors, runnable copy-paste examples.
- Optional frontmatter metadata only (title override, description, nav section/order, audience, tags, package/API relevance, llms inclusion, updated date); no page may require frontmatter to function.
- Internal linking convention decision (human): wikilinks vs relative Markdown links; the chosen convention must round-trip through MME preservation and resolve on the future site.
- Public/internal boundary check: nothing from `docs/internal/` leaks.

### Acceptance criteria

- The core docs set exists as `.md` files under `docs/public/` and opens cleanly in MME itself without corruption warnings.
- Each page passes a lint for heading structure, working internal links per the chosen convention, and runnable fenced examples.
- Frontmatter, where present, follows the documented optional schema; at least one page proves the no-frontmatter path.
- An LLM given a single page can answer integration questions without repo access (spot-checked, documented).
- Visual impact: no app UI change; documentation only.

### Implementation notes

HUMAN DECISION FIRST (stop and ask before writing pages): the internal linking convention — recommendation: relative Markdown links (`[Save truthfulness](../concepts/save-truthfulness.md)`) because they resolve on GitHub AND in MME; wikilinks remain preserved content but are not the docs convention unless the human picks them.

File plan under `docs/public/` (write in this order; each page must open in the MME demo without corruption diagnostics):

```
index.md                      overview + differentiator (byte-preserving rich editing)
quickstart/vanilla.md         quickstart/react.md      quickstart/next.md      quickstart/headless.md
concepts/document-model.md    concepts/preservation.md concepts/save-truthfulness.md
concepts/policy.md            concepts/ai-privacy.md   concepts/theming.md
concepts/preferences.md       concepts/extensions.md
packages/<one page per published package>.md
faq.md                        roadmap.md
```

Authoring rules (these ARE the AX contract): plain CommonMark/GFM only — no MDX, no HTML-only constructs required for meaning; one H1 per page; stable heading text (anchors derive from it); every fenced example has a language tag and is runnable as-is (copy-paste compiles); each page self-contained enough that an LLM can answer integration questions from that page alone; framework-neutral guidance separated from host-specific sections by headings.

Frontmatter is OPTIONAL metadata only — documented schema: `title`, `description`, `nav_section`, `nav_order`, `audience`, `tags`, `packages`, `llms` (include/exclude), `updated`. At least one page ships with NO frontmatter to prove the no-frontmatter path (nav falls back to file path + H1).

Tooling: `scripts/docs-lint.mjs` wired as `test:docs` — checks heading hierarchy (no skipped levels), internal link resolution per the chosen convention, fenced-example language tags, and the no-frontmatter-required rule (render each page's outline from headings only). The MME-0019 fidelity machinery is the corruption check: parse + serialize each page byte-identically.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: DX Reviewer and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, for the linking convention and public boundary.

### Reviewer

DX Reviewer.

### Status

Completed 2026-07-08; human approved the internal linking convention as relative Markdown links. Added the public `.md` docs baseline under `docs/public/` with overview, quickstarts, concepts, per-package pages, FAQ, and roadmap; kept existing glossary, compatibility promise, and AI provider docs as public-safe Markdown. Added `scripts/docs-lint.mjs` and `npm run test:docs` to enforce required pages, relative links, no public/internal leaks, no MDX/JSX in prose, heading hierarchy, fenced language tags, optional frontmatter schema shape, no-frontmatter coverage, and MME formatter identity. Proven by RED `npm run test:docs`, green `npm run test:docs`, `npm run test:render-html`, full `npm test`, and DX reviewer acceptance after frontmatter validation follow-up. `MME-0038` is the next candidate after issue-scoped commit.

## MME-0038 — Public docs site and AX docs surface

### Goal

Ship the public docs site as a read-only MME showcase with first-class Agentic Experience: the site renders the `docs/public/` Markdown through MME itself and exposes agent-friendly actions on every page.

### Scope

- Site rendering: `docs/public/` Markdown rendered through the MME read-only renderer (MME-0032), not a separate unrelated renderer; not editable by default; the site demonstrates MME rendering quality.
- Layout (Vercel-docs-like): left navigation generated from docs sections/files (frontmatter nav metadata optional, never required); center content; right outline panel generated automatically from headings/subheadings via the MME-0033 outline API — never from frontmatter.
- Internal links resolve per the MME-0037 convention, including wikilink or wikilink-equivalent links if selected; plan link suggestions/autocomplete between docs pages where relevant (may land as follow-up).
- Page actions: copy page as Markdown; copy page as LLM prompt/context; copy current section where practical; copy page link; Open-in-chat menu.
- Open-in-chat targets where feasible: v0, ChatGPT, Claude, Claude Code, Codex, Gemini, Mistral, T3 Chat, Scira, Cursor, OpenClaw, and Copilot-like coding agents; where reliable deep links are unavailable, fall back to copy-prompt behavior.
- The copied/opened prompt includes the page content plus instructions: use web search if available; prefer official docs; cite sources when browsing; respect MME's Markdown-as-source constraints; do not assume JSON/block DB persistence; separate framework-neutral guidance from host-specific integration.
- AX artifacts: `llms.txt` and `llms-full.txt` generated from the docs and kept in sync by an automated check.
- Examples gallery and landing page with a live editor demo using the default theme.

### Acceptance criteria

- Docs pages are served from the same Markdown files in the repo; editing a doc file updates the site without content forks.
- Center content is rendered by MME read-only rendering; a visible "rendered by MME" proof point exists.
- Left nav, right heading outline, and internal links work on pages with and without frontmatter.
- All five page actions work; Open-in-chat covers the feasible targets and copy-prompt fallback elsewhere; prompt template includes the required instructions.
- `llms.txt` and `llms-full.txt` exist, are generated, and a CI/test check fails when docs change without regeneration.
- Site is accessible (keyboard, contrast) and readable by both humans and coding agents (raw `.md` retrievable per page).
- Visual impact: new public site; screenshots under `docs/internal/visual-checks/MME-0038/`.

### Implementation notes

Site app lives in `apps/docs-site` as a static-export Next.js App Router app per human direction. This does not make Next required for MME consumers: the site is a host shell, while Markdown remains the durable source and MME still owns rendering/outline behavior. Content pipeline: read `docs/public/**/*.md` at build time → render the body through `@momentarise/md-render-html` (MME-0032) → outline from the MME-0033 outline API → left nav from the file tree with optional `nav_section`/`nav_order` frontmatter overrides. A quiet "Rendered by Momentarise Markdown Editor" proof point and the right-rail Page actions menu link to raw `.md` sources under `/docs/<page>.md`.

Page actions implementation: "copy as Markdown" = raw file contents; "copy section" = slice the raw source between heading `sourceRange`s from the outline API; "copy as LLM prompt" and "Open in chat" share ONE prompt template module containing the required instruction lines (use web search if available; prefer official docs; cite sources when browsing; respect MME's Markdown-as-source constraints; do not assume JSON/block DB persistence; separate framework-neutral guidance from host-specific integration) followed by the page Markdown.

Open-in-chat deep links: maintain a single table module `{ id, label, buildUrl(prompt) | null }`. Known-workable query-param targets (verify at implementation time, they change): ChatGPT `https://chatgpt.com/?q=`, Claude `https://claude.ai/new?q=`, Gemini, T3 Chat, Scira. For targets without reliable deep links (v0, Codex, Cursor, OpenClaw, Copilot-like IDE agents): the menu entry copies the prompt and shows a short "paste into <tool>" hint. URL-encode and truncate prompts to the target's practical URL length; fall back to copy when the encoded prompt exceeds ~8k chars.

AX artifacts: `scripts/generate-llms.mjs` produces `llms.txt` (index: site title, one-line description, curated page list with absolute links honoring the `llms` frontmatter flag) and `llms-full.txt` (concatenated page Markdown in nav order, separated by `---` + path headers). Wire a sync check (`test:llms-sync`) that regenerates into a temp file and diffs against the committed artifacts — fails when docs changed without regeneration.

Accessibility: the site reuses md-surface tokens/components where sensible; keyboard-complete nav/outline/actions; contrast inherits the MME-0030 audited tokens.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer, DX Reviewer, and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the public face and an external-link surface.

### Reviewer

UX Reviewer and DX Reviewer.

### Status

Code-complete 2026-07-08; human review pending because this issue is the public docs face and external-link surface. Reworked after human feedback from the original Vite direction into a static-export Next.js App Router app under `apps/docs-site`, reading `docs/public/**/*.md` at build time, rendering page bodies with `@momentarise/md-render-html`, deriving the right outline from `MarkdownEditorSession.getOutline()`, syncing raw `.md` files under `/docs/*.md` for static output/dev, and exposing copy Markdown, copy prompt, copy section, copy link, and Open-in-chat actions. Added `llms.txt`, `llms-full.txt`, `scripts/generate-llms.mjs`, `scripts/sync-docs-site-raw.mjs`, `scripts/dev-docs-site.mjs`, `scripts/preview-docs-site.mjs`, `npm run test:llms-sync`, `tests/docs-site-ax.test.mjs`, and `scripts/visual-check-mme0038.mjs` with screenshots under `docs/internal/visual-checks/MME-0038/`. DX/security reviewers reported no P0/P1/P2 findings; builder fixed all reported P3 hardening items. Follow-up specialized review on 2026-07-08 found stale package snippets for `md-theme`, `md-policy`, and `md-ai`; builder corrected the public Markdown sources, regenerated `llms` artifacts, and resynced raw docs. Visual follow-up moved the home page closer to the Vercel-docs benchmark by making the Next shell more product-like, removing duplicate rendered H1s, surfacing quickstart/concept cards before long prose, improving mobile nav, handling `/favicon.ico` outside the docs catch-all, and documenting future native MME docs primitives in `docs/internal/BACKLOG.md`. Second UI/AX follow-up made light the default docs scheme, added a persisted dark-mode toggle, real local docs search with `Cmd/Ctrl+K`, topbar `Ask AI`, breadcrumbs, badges, footer navigation, BlockNote-like content-first home order, and fixed the live demo CodeMirror wrapping bug. Third UI/content follow-up replaced the triangle mark/favicon, moved noisy raw/source/copy/open-in-chat controls out of the page header into a right-rail Page actions menu, changed the theme switch to sun/moon icons, made the live demo include raw HTML and an editable rendered preview that syncs back to the source pane, removed aggressive source active-line highlighting in the demo, and reorganized docs navigation/content around Getting Started, Foundations, Features, Styling, and Reference instead of package-first reading. Fourth route/footer follow-up split the public app into a product landing at `/`, docs at `/docs`, raw Markdown under `/docs/*.md`, and stronger landing/docs footer navigation. Post-route reviewer P3 fixes now normalize trailing slash static-preview routes, rewrite absolute `/docs/...` links through the docs router, and assert critical footer route targets in visual proof. Latest review follow-up expands the landing storytelling, moves the docs footer into the docs content column, frames the live demo as an editor surface, replaces the minimal raw-HTML proof with a styled `mme-*` HTML component plus slash-editor preview, and fixes rendered-preview-to-source serialization so native Markdown stays Markdown while `mme-*` custom HTML blocks remain HTML. Follow-up AX/CLI/layout pass adds `docs/public/concepts/agentic-experience.md`, expands the CLI guide, links AX/CLI from the top nav/home/footer, adds previous/next docs pagination, strengthens visual route proof for AX/CLI, and removes invalid docs-site CSS spacing token references (`--mme-space-7/8/9`) so landing/docs spacing resolves consistently. The active slash command implementation remains the existing `@momentarise/md-surface`/editor-demo feature, not a hidden docs-site command runner. Larger AX skills, reusable agent action manifests, BlockNote-class docs taxonomy coverage, and full light/dark public-release audits are recorded in `docs/internal/BACKLOG.md`. Follow-up Spark reviewers `Nietzsche` and `Nash` reported no remaining P0/P1/P2 findings after builder fixes. Proven by RED `npm run test:docs-site`, green `npm run test:docs-site`, `npm run test:docs`, `npm run test:llms-sync`, `npm run visual:mme-0038`, `git diff --check`, and full `npm test`. On 2026-07-16, the human explicitly asked to commit and continue while recording that MME-0038 was not explicitly validated. This is a pending-status commit/continuation, not an accepted public-face validation.

## MME-0039 — Interim demo visual refresh

### Status

Completed 2026-06-10, executed OUT OF PHASE ORDER by explicit human decision ("améliore l'UI tout de suite"), recorded in the build log. This slice does not change the phase sequence: MME-0020 remains the next phase-A issue.

### Goal

Make the demo presentable now, without waiting for the MME-0025/MME-0030 theming work, and without creating rework: the refreshed values become the draft defaults for the MME-0025 token set.

### Scope

- CSS-only changes in `apps/md-demo/src/styles.css`, in **Vercel-docs aesthetic** (near-black surfaces, monochrome grays, single blue accent), **default dark** with a light scheme via `:root[data-mme-scheme="light"]`.
- **All colors centralised** into a single `:root` block of `--mme-*` custom properties — the draft default values for the MME-0025 token set. No rule below `:root` uses a raw color/shadow/radius value; only `var(--mme-*)`.
- `--line` and `--font-mono` kept as aliases that reference the `--mme-*` tokens (consumed by `@momentarise/md-source-codemirror`'s default theme until MME-0025 migrates the package).
- No DOM, behavior, `data-testid`, or class-name changes.
- New `scripts/visual-check-mme0039.mjs` + `visual:mme-0039` script.
- Known limitation (routed to MME-0025): CodeMirror Markdown syntax-token colors still come from the package's light-oriented `defaultHighlightStyle`; the demo sets a legible dark base (content/cursor/selection/gutter) via stable `.cm-*` classes, but a real dark highlight style is package work owned by MME-0025.

### Acceptance criteria

- All existing tests pass unchanged (the CSS-snippet baseline tests pin the required selectors).
- Demo builds; visual artifacts captured under `docs/internal/visual-checks/MME-0039/` with README.
- Unsupported blocks read as quiet preserved content, not warning-colored debug output.
- Editing surfaces use a readable centered measure on desktop and degrade cleanly at 390px.
- Visual impact: major general-UI restyle; no editing-behavior change.

### Implementation notes

Completed (Vercel dark default + light, fully tokenised). For MME-0025: the `--mme-*` token NAMES and VALUES already live in `apps/md-demo/src/styles.css` `:root` and `:root[data-mme-scheme="light"]` (the header comment marks them as the draft token defaults) — lift them verbatim into `@momentarise/md-theme`, then migrate the CodeMirror package theme off the `--line`/`--font-mono` aliases and ship a real dark syntax-highlight style.

Visual recapture deferred for cost: the change is a CSS-only token swap and the CSS-snippet baseline tests pin every required selector, so it is low-risk. Run `npm run visual:mme-0039` (and a light-scheme pass by setting `document.documentElement.dataset.mmeScheme = "light"`) when spending on browser verification is acceptable; the previously committed `docs/internal/visual-checks/MME-0039/*.png` show the earlier (teal) styling and are stale until then.

### Execution model

- Implementation: sequential only (this slice was human-directed, out of phase order).
- Fresh context rebuild required: yes (human explicitly continued the session, but future agents must still rebuild context from docs/current state).
- Reviewer subagents: UX Reviewer when available.
- Parallel implementation: forbidden.
- Human review required: yes — the human is the requester and the visual judge.

### Reviewer

UX Reviewer (human).

## MME-0040 — Tables preservation and rendering

### Goal

Make Markdown table support credible for a public Markdown editor without pretending rich table editing is complete before it is safe.

### Scope

- Preserve GFM pipe tables byte-for-byte when untouched.
- Preserve unsupported or non-standard table syntax as raw/opaque Markdown instead of flattening it into lossy paragraphs.
- Render supported GFM tables in read mode and live-preview-capable rendered output.
- Keep source mode as the fallback for every table form.
- Ensure rich mode can mount and serialize documents containing tables without corrupting them.
- Add table fixtures and tests covering identity round-trip, edited-neighbor preservation, and renderer output.
- Document the boundary: this issue ships preserve/render/rich-safe fallback first; full spreadsheet-like rich cell editing is a future slice.

### Acceptance criteria

- Untouched supported GFM table fixtures round-trip byte-for-byte through parser, serializer, and rich mount/serialize.
- Editing content adjacent to a table changes only the edited block/range and leaves the table bytes intact.
- Unsupported or malformed table-like syntax is carried as raw/opaque Markdown and is not silently converted to paragraphs.
- `@momentarise/md-render-html` renders supported GFM tables as semantic table HTML with safe output.
- Rich mode displays a clear preserved-table fallback when direct cell editing is not supported.
- Tests prove table preservation, edited-neighbor behavior, renderer output, and rich-mode no-loss behavior.
- Visual impact: table content may render as semantic tables in read/docs/live rendered views; rich mode may show a preserved-table fallback instead of lossy editable paragraphs.

### Test-first plan

- RED: add table fixtures covering a normal GFM table, alignment markers, escaped pipes, blank lines around tables, and malformed/non-standard table syntax.
- RED: add parser/serializer identity and edited-neighbor tests proving tables survive untouched.
- RED: add `md-render-html` tests proving semantic table rendering and sanitizer-safe output.
- RED: add rich mount/serialize proof showing table blocks are preserved when not directly edited.

### Implementation notes

Read first: `packages/md-format`, `packages/md-core`, `packages/md-rich-prosemirror`, `packages/md-render-html`, `fixtures/`, existing round-trip tests, rich targeted serialization tests, and renderer tests.

Use the existing Markdown AST foundation and GFM-capable parsing path where available. Do not introduce a handwritten table parser unless it is only a narrow fallback around source-range preservation and is documented as such.

The rich-mode behavior for this issue is intentionally preservation-first. If ProseMirror schema support for editable table cells becomes too broad, stop and split full rich table editing into a later issue. The current issue must still make documents with tables safe to open, view, switch modes, and save without table corruption.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless table-rich-editing scope expands beyond preserve/render/fallback.

### Reviewer

Architecture Reviewer and Test Reviewer.

### Status

Completed 2026-07-19; code HITL remained waived for TypeScript/package work. Added a GFM table variants fixture covering alignment, escaped pipes, inline marks, blank-line boundaries, and malformed table-like syntax. The parser now adds opaque raw nodes for unsupported table-like runs outside fenced code while keeping supported GFM table ranges owned by the existing `remark-gfm` AST path. Rich mode still does not claim editable table cells: supported and malformed table-like blocks mount as explicit preserved-table source-only fallbacks and serialize back byte-for-byte. `@momentarise/md-render-html` has semantic/sanitizer table proof. Proven by RED `npm run test:parser`, green `npm run test:parser`, `npm run test:rich-fidelity`, `npm run test:rich-targeted-serialization`, `npm run test:render-html`, `npm run test:fixtures`, `npm run test:roundtrip`, `npm run test:serializer`, `npm run test:rich-prosemirror`, `npm run visual:mme-0040`, `git diff --check`, and full `npm test`. Test reviewer findings were fixed; compact architecture reviewer reported no P0/P1/P2 findings. `MME-0041` is the next candidate after issue-scoped commit.

## MME-0041 — Footnotes and endnotes

### Goal

Support GFM-style footnote references and definitions as serious Markdown content: preserved in source, rendered in read/live views, and navigable through backlinks.

### Scope

- Preserve `[^ref]` references and `[^ref]: definition` blocks through parser, serializer, source/rich switching, and no-op saves.
- Render footnotes/endnotes in read mode and live-preview-capable output.
- Support safe backlink navigation in rendered views.
- Keep source mode fallback for unusual footnote syntax.
- Add fixtures and tests for references, definitions, multi-line definitions, duplicate/missing references, and unusual syntax.
- Document the boundary: this issue ships preserve/render/navigation first; advanced rich insertion/edit UI is a future slice.

### Acceptance criteria

- Untouched footnote fixtures round-trip byte-for-byte through parser, serializer, and rich mount/serialize.
- Editing unrelated content does not rewrite footnote references or definitions.
- Rendered output includes stable footnote anchors and backlink links without unsafe HTML.
- Missing or unusual footnote syntax is preserved and diagnosed rather than silently dropped.
- Source mode remains the authoritative editing fallback for complex footnote definitions.
- Visual impact: read/docs/live rendered views gain footnote/endnote rendering and backlink navigation; rich mode may show preserved-footnote fallback for unsupported editing cases.

### Test-first plan

- RED: add fixtures for single footnote, repeated references, multi-line definition, missing definition, duplicate definition, and malformed syntax.
- RED: add round-trip and edited-neighbor preservation tests.
- RED: add renderer tests for footnote section output, anchor ids, backlinks, and sanitizer-safe links.
- RED: add rich mount/serialize identity proof for footnote documents.

### Implementation notes

Read first: `packages/md-format`, `packages/md-core`, `packages/md-rich-prosemirror`, `packages/md-render-html`, fixture harnesses, and renderer tests.

Prefer remark/unified-compatible footnote support if already present or available through the current parser stack. Public MME types must remain independent of third-party AST types. Preserve source ranges where feasible so section copy, prompt copy, and edited-neighbor behavior stay accurate.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Test Reviewer, DX Reviewer, and Architecture Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless rendered backlink UX requires a product decision.

### Reviewer

Test Reviewer and DX Reviewer.

### Status

Completed 2026-07-19; code HITL remained waived for TypeScript/package work. Added a GFM footnotes fixture covering repeated references, missing references, multi-line definitions, unreferenced definitions, duplicate definitions, unsafe definition HTML, and malformed footnote-like syntax. The parser now exposes native `footnoteReference` and `footnoteDefinition` identifiers, diagnoses missing/duplicate/malformed footnote syntax, and avoids inline-code lookalike false positives. Rich mode preserves footnote references in edited paragraphs and mounts definitions/unusual syntax as explicit preserved-footnote source-only fallbacks. `@momentarise/md-render-html` normalizes footnote anchors/backlinks to stable `mme-render-` fragments after sanitization, preserves duplicate/unreferenced definitions visibly in the render artifact, strips unsafe attributes/URLs from the artifact, and emits `render_html_footnote_preserved` diagnostics. Proven by RED `npm run test:parser`, `npm run test:rich-fidelity`, `npm run test:rich-targeted-serialization`, and `npm run test:render-html`; green targeted tests, `npm run visual:mme-0041`, `git diff --check`, and full `npm test`. Reviewer findings were fixed and rechecked with no remaining P0/P1/P2. `MME-0042` is the next candidate after issue-scoped commit.

## MME-0042 — Core editor interaction hardening

### Goal

Make everyday source/rich editing behavior reliable enough that users do not feel like they are switching between unrelated or fragile editors.

### Scope

- Harden Enter, Backspace, paste, selection, undo/redo, Tab, and Shift+Tab behavior in source and rich modes where framework-owned.
- Cover nested unordered lists, ordered lists, and task lists.
- Ensure lists and todos continue, indent, outdent, split, and exit predictably.
- Ensure document-end insertion works after code fences, callouts, opaque blocks, preserved tables, HTML blocks, inserted media, and other framed blocks.
- Add explicit block insertion affordances before/after framed or opaque blocks when direct text insertion would trap the user.
- Keep source mode as fallback and preserve Markdown bytes for unaffected ranges.
- Defer full mobile/tablet virtual-keyboard work to a later issue unless a desktop fix would obviously break touch layouts.

### Acceptance criteria

- Source-mode list/todo continuation, indentation, outdent, and exit behavior remain covered by automated or browser-driven tests.
- Rich-mode nested list/todo Enter, Backspace, Tab, Shift+Tab, paste, and undo/redo behavior are covered by automated tests where practical.
- Clicking or keyboard-moving after the final block creates/focuses a paragraph after that block.
- Editing around opaque, table, code, callout, media, and raw HTML blocks does not rewrite unrelated source bytes.
- Visual proof covers the core interaction scenario in the reference demo.
- Visual impact: editing surfaces gain more predictable insertion and navigation behavior around complex blocks; no unrelated general UI redesign.

### Test-first plan

- RED: add rich/source behavior tests for nested lists, nested todos, Tab/Shift+Tab, Enter split/exit, Backspace merge/exit, paste, and undo/redo.
- RED: add document-end insertion tests around code fences, opaque blocks, callouts, table fallback blocks, raw HTML, and inserted media placeholders.
- RED: add visual script scenario proving keyboard and mouse insertion after final framed blocks.

### Implementation notes

Read first: `packages/md-source-codemirror`, `packages/md-rich-prosemirror`, `packages/md-editor`, `packages/md-surface`, existing source keymap tests, rich input-rule tests, rich UX baseline tests, and visual scripts for MME-0021/MME-0029.

Treat this as framework interaction hardening, not demo-only event patching. Prefer shared command/helpers in the rich/source packages over special cases in `apps/md-demo`.

Do not loosen Gate 4.5 to make an interaction appear to work. If an interaction cannot preserve unaffected Markdown ranges, keep the source fallback and document the limitation.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation, but visual artifacts are mandatory.

### Reviewer

UX Reviewer and Test Reviewer.

### Status

Completed 2026-07-19; code HITL remained waived for TypeScript/package work. Added focused rich/source interaction proof for source keymap coverage, rich nested list/todo paste plus undo/redo, and final-block insertion after code fences, preserved tables, callouts/opaque blocks, raw HTML blocks, and image-only media placeholders. `@momentarise/md-rich-prosemirror` now exposes `insertParagraphAfterFinalBlock` / `canInsertParagraphAfterFinalBlock`, reuses shared paragraph-insertion transactions, supports ArrowDown/ArrowRight from final framed blocks, and handles empty-tail mouse insertion only on true editor-root clicks below the final eligible block. The demo adds a test-only final-block selection hook and visual proof for keyboard insertion after a final preserved table and mouse insertion after a final callout fallback. Proven by RED `npm run test:rich-core-interactions`, green targeted checks, `npm run visual:mme-0042`, `git diff --check`, and full `npm test`. Test reviewer found one P2 overly-broad click-target issue; builder fixed it and recheck reported no remaining P0/P1/P2. UX visual reviewer reported no P0/P1/P2. `MME-0043` is the next candidate after issue-scoped commit.

## MME-0043 — Live Preview parity foundation

### Goal

Introduce the foundation for Obsidian-class Live Preview behavior while preserving the central product truth: Markdown remains the durable source and derived views must not rewrite untouched content.

### Scope

- Define the `Live Preview` mode boundary in the headless editor/session model and surface controls.
- Render common Markdown constructs typed in rich/live contexts without requiring a source/rich mode bounce.
- Cover headings, paragraphs, thematic breaks, blockquotes, links, inline code, code fences, unordered lists, ordered lists, task lists, and safe raw inline/block HTML where policy allows.
- Keep unsupported constructs as raw/opaque content, never flattened approximations.
- Ensure mode switches between Source, Rich, and Live Preview do not alter untouched documents.
- Update docs and user-facing labels only where needed to avoid overclaiming feature completeness.

### Acceptance criteria

- `Live Preview` is a distinct, documented mode or mode behavior, not just a renamed rich mode.
- Common typed Markdown constructs render in place where safe and predictable.
- Raw inline/block HTML inside Markdown renders only through the existing policy/sanitization boundary and preserves source bytes.
- Full fixture corpus identity still passes through mount/mode-switch/save paths.
- Edited-block preservation tests prove unrelated ranges survive byte-for-byte.
- Mode controls expose Live Preview only for Markdown documents, not standalone HTML artifacts.
- Visual impact: editor mode controls and editing surface gain Live Preview behavior for common Markdown constructs.

### Test-first plan

- RED: add mode/session tests for Live Preview registration, transitions, and document-kind availability.
- RED: add typed-construct tests for headings, lists, todos, quotes, links, code fences, and HTML policy cases.
- RED: add corpus-wide identity test covering Source -> Live Preview -> Source and save/copy/download paths.
- RED: add visual proof showing live typed constructs without a mode bounce.

### Implementation notes

Read first: `packages/md-editor`, `packages/md-rich-prosemirror`, `packages/md-source-codemirror`, `packages/md-render-html`, `packages/md-policy`, `packages/md-surface`, MME-0033 outline APIs, and Gate 4.5 tests.

This is a foundation issue. It should not attempt perfect Obsidian parity for every extension in one slice. It must establish the contracts and prove the common path without creating a corrupting derived view.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, UX Reviewer, Test Reviewer, and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes if the visible mode model or naming differs from `Source`, `Rich`, and `Live Preview`.

### Reviewer

Architecture Reviewer and UX Reviewer.

### Status

Completed 2026-07-19; code HITL remained waived for TypeScript/package work. Added the `live-preview` editor mode contract, Markdown/HTML artifact mode availability APIs, labeled Source/Rich/Live Preview controls, and a demo Live Preview surface that reuses safe rich rendering while staying distinct from Rich mode through its banner, no rich toolbar, and hidden rich block affordances. Added live typed Markdown proof for headings, lists, tasks, blockquotes, thematic breaks, code fences, inline code, links with titles, unsafe links, image-like Markdown, raw HTML render policy, full fixture identity, edited-range preservation, copy/export content stability, save flush behavior, and clean/dirty external-change handling. Visual proof covers Live Preview typed constructs, the same document in Rich mode, dirty Live Preview conflict handling, and HTML artifact Source/Preview-only controls. Proven by RED `npm run test:live-preview`, green targeted checks, `npm run visual:mme-0043`, `git diff --check`, and full `npm test`. Reviewers found P2 gaps in visual distinction, ARIA/source labeling, save/external-change coverage, Live Preview/Rich behavior separation, and link parsing; builder fixed them and rechecks reported no remaining P0/P1/P2. `MME-0044` is the next candidate after issue-scoped commit.

## MME-0044 — Unified Open, New File, Save As, and status chrome

### Goal

Make file opening, creation, saving, conflict handling, and document status feel like an editor-grade workflow while preserving Save Engine truthfulness.

### Scope

- Unify `Open .md` and `Open .html` into one Open action with type detection or a clear secondary type/filter menu.
- Add `New file` and `Save As` flows for Markdown documents.
- When File System Access can create or write a file, make the created/saved target a real writable target for later Save and autosave.
- When the host cannot create writable files, fall back to export/download without implying disk persistence.
- Replace permanent demo/debug status chrome with an editor-grade status pattern that exposes file name, URI/path, adapter kind, writability, persistence target, dirty/saving/saved/conflict/error, last saved timestamp, and save details.
- Provide explicit conflict resolution actions: reload external, keep/export local copy, retry after resolving, and dismiss only when safe.
- Ensure standalone HTML documents expose Source/Preview controls without disabled or confusing Rich/Live Preview modes.

### Acceptance criteria

- A single Open entry point can load supported Markdown and HTML artifacts and route them to the correct document-kind UI.
- New Markdown document creation works in supported browsers and falls back truthfully elsewhere.
- Save As creates a writable `.md` target when the host supports it; later Save/autosave writes to that target.
- Fallback import/export/download states never claim the original disk file was overwritten.
- Conflict UI offers explicit resolution actions and never overwrites dirty local edits with external content.
- Status chrome is compact and editor-grade while preserving discoverable details.
- Automated tests cover status derivation, target transitions, fallback labels, and conflict actions; visual proof covers the main user flows.
- Visual impact: major file/status UI change in the reference demo and reusable surface components.

### Test-first plan

- RED: add SaveTarget/state transition tests for New file, Save As, writable target, fallback export, and conflict resolution.
- RED: add surface DOM tests for compact status menu/popover and action availability.
- RED: add browser/manual visual script for Open, New file, Save As fallback, and conflict actions.

### Implementation notes

Read first: `packages/md-save`, `packages/md-editor`, `packages/md-surface`, `apps/md-demo/src/main.ts`, web file adapter helpers, MME-0008/MME-0009/MME-0035 tests, and existing visual scripts for save/open/conflict behavior.

Keep Save Engine semantics central. UI labels may improve, but they must not hide target truth. Host adapters own file creation mechanisms; the browser demo proves the File System Access and fallback paths only.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer, Test Reviewer, Architecture Reviewer, and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes because this changes the core visible file/status workflow.

### Reviewer

UX Reviewer and Test Reviewer.

### Status

Accepted for code continuation 2026-07-19 after human instruction to defer visible workflow reviews into a final end-of-run review queue. Added browser save-picker creation APIs, New file and Save As flows, unified visible Open routing for Markdown/HTML, compact status details for adapter/writability/last-saved/save hashes, and explicit conflict actions without unsafe dismiss. Fallback Markdown imports and unsupported save-picker hosts stay `download-required`/export-only and never claim original disk overwrite. Visual proof covers initial status chrome, Markdown imported copy, HTML Source/Preview-only routing, New writable file, Save As writable target, and dirty external conflict actions. Proven by RED `npm run test:web-file-access` and `npm run test:surface`, green targeted checks, `npm run visual:mme-0044`, `git diff --check`, and full `npm test`. Reviewer subagents found P2s in legacy debug opener routing and new status string API strictness; builder fixed both and rechecks reported no remaining P0/P1/P2. This is not final public workflow acceptance; the Open/New/Save As/status workflow is queued for final human review before public launch. `MME-0045` remains the next candidate after issue-scoped commit.

## MME-0045 — Toolbar, slash, and mode controls final UX

### Goal

Make the reusable command and mode-control surfaces feel premium, keyboard-first, and host-configurable without moving logic back into the demo.

### Scope

- Finalize slash menu placement, empty states, labels, grouping, fuzzy matching, keyboard navigation, and constrained/mobile layout behavior.
- Ensure slash commands cover block insertion, formatting commands, document actions, AI entry points, and host-provided commands.
- Harden toolbar and bubble-toolbar visibility, active/disabled states, grouping, keyboard access, iconography, density, and host preference integration.
- Replace demo-style segmented controls with an editor-grade mode picker/toggle pattern driven by preferences.
- Make mode controls document-kind aware: Markdown exposes Source/Rich/Live Preview; standalone HTML exposes Source/Preview.
- Keep all surfaces using `@momentarise/md-theme` tokens, `IconSet`, preferences, and injected strings.

### Acceptance criteria

- Slash menu supports fuzzy search, grouping, aliases, empty state, keyboard navigation, and stable host command registration.
- Toolbar and bubble toolbar expose clear active/disabled states and remain keyboard-accessible.
- Mode controls are compact, document-kind aware, and host-configurable through preferences.
- No surface component introduces hardcoded colors, font values, spacing values, shortcuts, or user-facing strings outside token/string contracts.
- Tests cover command filtering, keyboard behavior, disabled states, preference-driven variants, and document-kind availability.
- Visual impact: major command/mode surface polish across desktop and constrained/mobile layouts; screenshots under `docs/internal/visual-checks/MME-0045/`.

### Test-first plan

- RED: add `md-surface` DOM tests for fuzzy slash filtering, empty states, keyboard navigation, toolbar states, and mode-control document-kind behavior.
- RED: add preference tests for host-configured command/mode surface variants.
- RED: add visual script for desktop, constrained IDE pane, and mobile-width command/mode workflows.

### Implementation notes

Read first: `packages/md-surface`, `packages/md-editor`, `packages/md-theme`, `packages/md-rich-prosemirror`, MME-0027 extension registry tests, MME-0028 surface tests, MME-0029 block affordance tests, and MME-0030 theme visual artifacts.

This issue owns reusable capability. Do not solve command UX by hardcoding demo-specific DOM. If UX details remain subjective, make them configurable through existing preference contracts rather than adding one-off UI state.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer, Architecture Reviewer, and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes because this is a major product-surface polish pass.

### Reviewer

UX Reviewer and Architecture Reviewer.

### Status

Accepted for code continuation 2026-07-19 after reusable command-surface hardening, reviewer rechecks, strengthened visual proof, and full test pass. Added fuzzy slash search/ranking, grouped slash sections, focusable listbox active-descendant wiring, empty state, AI entry-point coverage, toolbar and selection-bubble active/disabled state, non-built-in extension toolbar rendering without `host:` namespace coupling, host-configurable mode-control variants, and clean external-apply overlay reset. The demo now uses package-owned selection-bubble controls instead of static command scaffolding. Visual proof covers fuzzy slash grouping, AI slash entries, toolbar/selection bubble state, single-toggle mode control, constrained/mobile reachability, two-axis/pointer command-surface bounds, and clean external apply closing stale overlays. Proven by RED `npm run test:surface` and `npm run test:extension-registry`, green targeted checks, `npm run visual:mme-0045`, `git diff --check`, and full `npm test`. Reviewer subagents found P2s in slash accessibility ownership, toolbar namespace filtering, static demo masking, visual proof scope, constrained/mobile reachability, overflow proof, and external-apply lifecycle; builder fixed all, and both reviewers rechecked with no remaining P0/P1/P2. Final human command-surface product review is queued in `docs/internal/BACKLOG.md`; `MME-0046` remains the next candidate after issue-scoped commit.

## MME-0046 — HTML preview reading polish

### Goal

Make standalone HTML artifact preview useful for normal reading while keeping sandbox and persistence truth discoverable.

### Scope

- Remove permanent technical HTML status strips/banners from the normal preview reading surface.
- Move sandbox/script/save truth into a discreet status affordance, inspector, hover/detail menu, toast, or debug surface.
- Reduce nested/conflicting scroll regions and large blank preview gutters.
- Let preview use the available app viewport naturally instead of device/debug controls.
- Keep standalone HTML artifact preview separate from inline/block HTML inside Markdown.
- Preserve scripts-disabled-by-default sandbox behavior and explicit host opt-in semantics.

### Acceptance criteria

- Normal HTML preview has no permanent debug banner or technical strip.
- Sandbox tokens, script state, document target, and save truth remain discoverable.
- Preview layout has one obvious reading surface and avoids nested scroll traps.
- Scripts remain disabled by default and tests prove the sandbox boundary.
- Visual impact: standalone HTML reading surface becomes cleaner and more document-like.

### Test-first plan

- RED: add/update HTML preview tests proving default sandbox tokens remain strict and status details stay available.
- RED: add surface/demo DOM tests for the discreet status affordance.
- RED: add visual proof for normal HTML reading at desktop and constrained widths.

### Implementation notes

Read first: `packages/md-preview-html`, `packages/md-surface`, `apps/md-demo`, MME-0015 HTML visual checks, and MME-0032 sandbox default changes.

This is reading polish, not an advanced HTML template system. If a richer artifact template/editor is needed, split it later.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation, but screenshots and reviewer pass are mandatory.

### Reviewer

UX Reviewer and Security Reviewer.

### Status

Accepted for code continuation 2026-07-19 after HTML-preview reading polish, reviewer rechecks, visual proof, and full test pass. Removed the permanent technical preview banner from the normal standalone HTML reading surface, added a discreet `Preview details` disclosure for file, sandbox tokens, script state, target, and save truth, kept HTML artifacts on the download/export persistence path, and tightened tests proving `allow-scripts` cannot be enabled in V0. Visual proof covers desktop reading, constrained-width reading, details-open disclosure, and hostile inline script blocking. Proven by RED `npm run test:demo-html-preview`, green targeted checks, `npm run visual:mme-0046`, `git diff --check`, and full `npm test`. Security and UX reviewer subagents reported no P0/P1/P2 findings; a final delta reviewer also reported no new P0/P1/P2 after the save-truth refresh. Final human HTML-preview product review is queued in `docs/internal/BACKLOG.md`; `MME-0047` remains the next candidate after issue-scoped commit.

## MME-0047 — Folding and document structure polish

### Goal

Make folding feel like a subtle editor feature, preserve source truth, and keep heading hierarchy behavior predictable.

### Scope

- Polish folding affordances against Obsidian and CodeMirror-style editor gutters without copying assets or CSS.
- Move fold controls into a subtle gutter/margin that appears on hover/focus and supports keyboard access.
- Use a minimal collapsed marker such as `...`.
- Ensure H1-H6 folding is hierarchical: folding a heading hides child section content until the next same-or-higher heading.
- Keep nested parent/child fold state predictable when parents collapse and expand.
- Cover code-block and callout folding where supported and source-safe.
- Keep folding state as interface state; never mutate Markdown.

### Acceptance criteria

- Folding a heading hides only the correct hierarchical section.
- Parent/child fold state remains predictable through collapse/expand cycles.
- Fold controls are accessible by keyboard and screen-reader labels.
- Folding code blocks/callouts does not mutate Markdown source.
- Tests cover fold ranges, hierarchy, nested state, and no-source-mutation.
- Visual impact: folding controls become quieter and more editor-grade.

### Test-first plan

- RED: add fold hierarchy tests for H1-H6 nested documents.
- RED: add no-source-mutation tests for headings, code blocks, callouts, and opaque blocks.
- RED: add visual proof for hover/focus fold affordances and collapsed markers.

### Implementation notes

Read first: folding implementation from MME-0014, `packages/md-editor`, `packages/md-rich-prosemirror`, `packages/md-surface`, outline APIs from MME-0033, and existing folding visual checks.

Do not convert toggle blocks into folding state. Toggle blocks are document content inserted only explicitly; folding remains interface state.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation, but visual proof is mandatory.

### Reviewer

UX Reviewer and Test Reviewer.

### Status

Accepted for code continuation 2026-07-19 after folding hierarchy/source-truth polish, reviewer rechecks, visual proof, and full test pass. Added generic `getRichFoldItems`/`toggleRichFold` APIs while keeping heading-specific compatibility APIs, made code blocks, callouts, and opaque raw blocks foldable as interface state only, kept H1-H6 parent/child fold state predictable, and proved folding never mutates serialized Markdown. Demo folding controls now use a quieter gutter/focus affordance, contextual screen-reader labels, and visible collapsed markers for headings and non-heading blocks. Visual proof covers quiet focused gutter controls, code/callout/opaque collapsed states, and nested parent/child persistence. Proven by RED `npm run test:rich-folding` and `npm run test:demo-folding`, green targeted checks, `npm run visual:mme-0047`, `git diff --check`, and full `npm test`. Test/API reviewer reported no P0/P1/P2 findings; UX reviewer found two P2s around non-heading marker clarity and generic labels, builder fixed both, and delta review reported no remaining P0/P1/P2. Final human folding product review is queued in `docs/internal/BACKLOG.md`; `MME-0048` remains the next candidate after issue-scoped commit.

## MME-0048 — Public docs launch hardening and MME-0038 validation debt

### Goal

Resolve the explicit MME-0038 public-face validation debt and harden the docs site before any public launch or release-ready claim.

### Scope

- Audit docs IA, navigation, page structure, copy, package guidance, CLI guidance, examples, and external-link behavior.
- Compare public docs claims against current package APIs and test/visual evidence.
- Verify AX claims truthfully distinguish shipped raw Markdown, copy prompt, Open-in-chat fallback, `llms` artifacts, CLI behavior, and not-yet-shipped skills/hosted Ask AI/semantic search.
- Audit light and dark schemes across docs components, code blocks, live editor demo, footer, page actions, mobile layout, and framework token usage.
- Resolve or explicitly document the MME-0038 non-validation status through human review.
- Keep docs content in `docs/public/` as plain Markdown; no MDX/JSX as source.

### Acceptance criteria

- MME-0038 explicit public-face validation debt is resolved or remains blocked with concrete human findings.
- Public docs content matches current package APIs and does not overclaim AI, AX, persistence, adapter, or rich/live-preview capabilities.
- Docs light/dark screenshots cover landing, docs home, package page, AX page, CLI page, mobile layout, code blocks, and live demo.
- External links and Open-in-chat fallback behavior are verified or bounded with truthful copy.
- `npm run test:docs`, `npm run test:docs-site`, `npm run test:llms-sync`, and visual docs proof pass.
- Human review required and recorded before marking complete.
- Visual impact: public docs/site visual and copy hardening; no core editor behavior change unless a docs proof exposes a blocker.

### Test-first plan

- RED: add or update docs-site assertions for every launch-critical route, light/dark page type, AX/CLI claim, and API snippet.
- RED: add docs lint checks for stale or misleading public claims where practical.
- RED: add visual proof matrix for launch-critical pages.

### Implementation notes

Read first: `apps/docs-site`, `docs/public`, `scripts/docs-lint.mjs`, `tests/docs-site-ax.test.mjs`, `scripts/visual-check-mme0038.mjs`, `llms.txt`, `llms-full.txt`, package READMEs, MME-0038 build-log entry, and `docs/internal/BACKLOG.md` public framework follow-ups.

This issue is validation and hardening, not a rewrite from zero. If the audit proves a deeper docs architecture issue, stop and split that work.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: DX Reviewer, UX Reviewer, and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, mandatory public-face validation.

### Reviewer

DX Reviewer and UX Reviewer.

### Status

Accepted for code continuation 2026-07-19 after public docs launch hardening, MME-0038 validation-debt proof, reviewer pass, expanded docs visual proof, and full test pass. Added `tests/docs-launch-hardening.test.mjs` for launch-critical package/API, AX, Ask AI, CLI, Open-in-chat, light/dark, and visual-artifact assertions; hardened public package docs for API checkpoints and 0.x release boundaries; regenerated `llms-full.txt`; and expanded the MME-0038 visual matrix with CLI package, AX page, dark package-code, and mobile package screenshots. DX/truth reviewer and visual reviewer reported no P0/P1/P2 findings. Final public-face human validation is still queued in `docs/internal/BACKLOG.md`; this status does not claim public launch acceptance. The visual reviewer noted a P3 about the floating round `N` overlay in mobile screenshots, queued for final screenshot/public-proof review. `MME-0049` remains the next candidate after issue-scoped commit.

## MME-0049 — AX skills, manifests, and reusable agent actions

### Goal

Make MME's Agentic Experience durable and generated from public docs instead of maintaining separate stale agent prose.

### Scope

- Create durable Codex/agent skills for MME docs usage, migration help, package selection, AI/privacy boundary checks, and docs-to-implementation prompts.
- Generate or sync those skills from `docs/public/`, `llms.txt`, `llms-full.txt`, and package metadata where practical.
- Add reusable agent action descriptors for copy Markdown, copy section, copy prompt, Open-in-chat fallback, edit-on-GitHub, issue filing, and future ask-this-page behavior.
- Keep host-owned UI chrome separate from reusable AX descriptors.
- Ensure generated artifacts do not expose internal-only docs unless explicitly intended.
- Document how agents should cite source docs and avoid claiming JSON/block DB persistence.

### Acceptance criteria

- Agent skill/manifests exist in the chosen repository-owned location or generation output path and are documented.
- Generated or synced artifacts fail tests when public docs or `llms` sources change without regeneration.
- Skills reference public Markdown docs and package APIs, not stale duplicate prose.
- Action descriptors are reusable by the docs site and future hosts without hardcoding one UI.
- Security/DX review confirms no private internal docs, secrets, or misleading AI/provider claims are exposed.
- Visual impact: docs site may expose clearer agent action affordances; no editing-surface behavior change unless action UI is reused there.

### Test-first plan

- RED: add generator/sync tests proving skills/manifests derive from current public docs or fail on drift.
- RED: add privacy/public-boundary test proving internal docs are excluded.
- RED: add action-descriptor contract tests for copy/open/edit/issue action payloads.

### Implementation notes

Read first: `docs/public`, `apps/docs-site`, `scripts/generate-llms.mjs`, `llms.txt`, `llms-full.txt`, MME-0038 AX docs, `docs/internal/BACKLOG.md` public AX follow-ups, and available Codex skill conventions in the local environment.

This issue may require a product decision about the exact committed skill location. If writing outside the repository is required, stop and ask. Prefer repository-owned generated artifacts first.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: DX Reviewer and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes if generated skills become public distribution artifacts.

### Reviewer

DX Reviewer and Security Reviewer.

### Status

Accepted for code continuation 2026-07-19 after generated repo-owned Agentic Experience artifacts, descriptor-driven docs actions, public-boundary tests, docs visual proof, reviewer pass, and full test pass. Added `scripts/generate-agent-artifacts.mjs`, generated `docs/agent/manifest.json`, `docs/agent/actions.json`, and five `docs/agent/skills/*/SKILL.md` files from public Markdown docs, `llms.txt`, `llms-full.txt`, and package metadata. Added `tests/agent-artifacts.test.mjs` and wired `test:agent-artifacts` into root `npm test`; the test proves drift detection, public-only boundaries, package metadata derivation, reusable action descriptors, shipped/future action availability, and docs-site descriptor consumption. The docs site now imports the generated action registry through `apps/docs-site/src/agent-actions.ts`, validates the registry schema/source boundary, renders page actions from descriptors, and filters Open-in-chat targets to shipped descriptors only. DX and security reviewers reported no P0/P1/P2 findings; builder fixed P3s for stale metadata, registry robustness, CWD fragility, and shipped target filtering. Final AX artifact distribution/product review is queued in `docs/internal/BACKLOG.md`; `MME-0050` remains the next candidate after issue-scoped commit.

## MME-0050 — Performance budgets and large-document benchmarks

### Goal

Define and enforce a public performance floor before making stronger public framework-readiness claims.

### Scope

- Define performance budgets for parse, serialize, rich mount, render HTML, outline generation, find/replace indexing, save-state hashing, and docs-site render paths where applicable.
- Add large-document fixtures, including at least one 10k-line Markdown document with headings, lists, code fences, links, tables, footnotes, HTML, callouts, and opaque/custom syntax.
- Add CI-runnable benchmark scripts with thresholds and clear machine-readable output.
- Prove small edits in large documents do not force avoidable full-document rewrites where targeted preservation is expected.
- Debounce expensive status checks without making save truth stale.
- Document residual performance risks and when virtualization or deeper incremental parsing would become necessary.

### Acceptance criteria

- Benchmarks are runnable by one documented command and produce stable, machine-readable output.
- 10k-line fixture coverage exists and is not a tiny repeated mock that misses real Markdown structures.
- Thresholds are committed and fail when performance regresses beyond the documented budget.
- Tests prove targeted edit behavior remains source-preserving on large documents.
- Save/status work stays truthful even when expensive checks are debounced.
- Visual impact: no visible editing or general UI changes unless performance work exposes a necessary loading/progress affordance.

### Test-first plan

- RED: add performance budget fixture and benchmark command that fails before thresholds/coverage exist.
- RED: add large-document targeted edit preservation test.
- RED: add save/status debounce truthfulness test if debounce behavior changes.

### Implementation notes

Read first: `packages/md-format`, `packages/md-editor`, `packages/md-save`, `packages/md-render-html`, `packages/md-rich-prosemirror`, existing fixture generation tools, consumer/publishability scripts, and CI workflow.

Use benchmarks as guardrails, not vanity metrics. If current architecture cannot meet a necessary budget without large refactor, stop with evidence and split the refactor.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless benchmark thresholds imply public product promises.

### Reviewer

Architecture Reviewer and Test Reviewer.

### Status

Accepted for code continuation 2026-07-19 after adding committed performance budgets, a generated 10k-line large Markdown fixture, CI-runnable JSON benchmark output, large-document parse/serialize/rich/render/outline/find/save guardrails, source-preserving targeted edit proof, and autosave hash/content truthfulness proof. Added `scripts/generate-large-performance-fixture.mjs`, `fixtures/021-large-performance/`, `docs/internal/performance-budgets.json`, `scripts/performance-benchmarks.mjs`, `tests/performance-budgets.test.mjs`, `docs/public/concepts/performance.md`, package scripts, regenerated `llms` files, and refreshed generated agent artifacts after the new public doc changed the AX manifest. Performance/DX reviewer reported no P0/P1/P2 findings; builder fixed P3s for JSON-only report wording, explicit CI guard command, bounded docs render coverage, and fixture variability. Preservation/save reviewer initially found P2s for benchmark-level save hash/content truth and session replace preservation; builder fixed both and reviewer confirmation found no remaining P0/P1/P2. Proven by RED missing-generator failure, green `npm run test:performance-budgets`, `npm run test:fixtures`, `npm run test:docs`, `npm run test:docs-site`, `npm run test:llms-sync`, `npm run test:agent-artifacts`, `git diff --check`, and full `npm test`. Final budget-threshold and fixture-representativeness review is queued in `docs/internal/BACKLOG.md`; `MME-0051` was promoted next from backlog after the issue-scoped evidence commit.

## MME-0051 — Asset upload provider contract and image paste/drop preservation

### Goal

Define the host-owned asset upload contract that lets MME insert image references from paste/drop/import flows without taking over storage, embedding unsafe data, or weakening Markdown source truth.

### Scope

- Add an optional asset upload/provider contract for image-like files and pasted assets.
- Keep storage decisions host-owned: MME asks for an asset result and inserts Markdown only after the provider returns a safe URL/path plus metadata.
- Support structured unavailable, denied, failed, and pending states without mutating the document.
- Add source/rich/headless helpers for inserting Markdown image syntax from a provider result while preserving unrelated source bytes.
- Prove paste/drop-like flows with fake file objects in tests; do not require browser-only APIs for core package tests.
- Document the host boundary and safe defaults for demos/docs.

### Acceptance criteria

- Public package exports describe asset provider inputs, success results, failures, and unavailable states.
- If no provider is configured or policy denies the upload, the document remains unchanged and callers get a truthful structured result.
- Successful image insertion emits normal Markdown image syntax, not a hidden JSON block or framework-owned asset database.
- Unrelated Markdown bytes survive targeted image insertion in source/rich/headless paths.
- Providers must not be called before policy/capability checks that can deny asset egress.
- Tests cover success, denied/unavailable/failure, alt text/title escaping, no data-URL default, source preservation, and save truth.
- Visual impact: no visible editing/general UI change unless a minimal existing command surface needs to expose disabled/enabled asset insertion state.

### Test-first plan

- RED: add asset provider contract tests that fail because no contract/export exists.
- RED: add targeted image insertion preservation tests for source/rich/headless session paths.
- RED: add policy/capability denial tests proving no provider call and no document mutation.

### Implementation notes

Read first: `packages/md-core`, `packages/md-editor`, `packages/md-policy`, `packages/md-surface`, `packages/md-rich-prosemirror`, `packages/md-react`, `packages/md-save`, `apps/md-demo/src/main.ts`, existing slash/toolbar command tests, save truth tests, and public docs around document access policy and editor UI.

Keep this as a reusable framework contract, not a demo-only upload button. Do not add a real hosted upload service, cloud storage SDK, drag/drop product UI overhaul, media library, or image optimization pipeline in this slice. If browser drag/drop UI needs product decisions, keep it as a follow-up and prove the reusable contract first.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Security Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless storage defaults, privacy policy, or public upload UX decisions are needed.

### Reviewer

Architecture Reviewer, Security Reviewer, and Test Reviewer.

### Status

Accepted for code continuation 2026-07-19 after adding the host-owned asset upload provider contract, safe Markdown image helpers, `session.insertAsset`, policy-before-provider export/write checks, structured unavailable/denied/failed/pending results, provider exception handling, syntax-hardened image URL serialization, and source/rich/headless preservation tests. Successful uploads insert normal Markdown image syntax only; no hidden asset database, data URL default, or framework-owned storage was added. Proven by RED missing-export proof, green `npm run test:asset-upload-provider`, `npm run test:serializer`, `npm run test:rich-commands`, `npm run test:roundtrip`, `npm run test:public-api`, `npm run test:docs`, `npm run test:docs-site`, `npm run test:llms-sync`, `npm run test:agent-artifacts`, `git diff --check`, and full `npm test`. Architecture/security and test/preservation reviewer subagents reported no P0/P1/P2 findings; builder fixed P3s for malformed JS input, policy resolver exceptions, URL syntax hardening, pending-result coverage, and formatter-level image escaping proof. Final storage-provider, privacy, and visible upload UX review is queued in `docs/internal/BACKLOG.md`; no executable normal issue remains after MME-0051 until the next backlog item is promoted.

## MME-0052 — Plain text and lightweight source file support

### Goal

Add truthful source-only handling for plain text and adjacent source-like files without implying Markdown round-trip, rich editing, or preview semantics that MME cannot preserve.

### Scope

- Classify `.txt`, `.text`, `.log`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, and `.toml` as lightweight source documents where supported by host adapters.
- Keep Markdown-specific Source/Rich/Live Preview behavior limited to Markdown documents.
- Open lightweight text files in source mode with truthful document-kind, route, save, writable/imported-copy, and line-ending behavior.
- Preserve source bytes for plain text files through open/edit/save/export paths; do not parse them as Markdown for preservation claims.
- Keep CSV/JSON/YAML/TOML semantic previews, validation, formatting, syntax-specific editing, and Markdown conversion out of this slice.
- Document host/source-only boundaries for lightweight files.

### Acceptance criteria

- Public package exports or documented host helpers expose a reusable document-kind classifier for Markdown, HTML, and lightweight text/source files.
- Demo/web adapter open/import routing accepts the lightweight text extensions and reports them as source-only documents, not Markdown documents.
- Mode availability is document-kind aware: lightweight text files expose Source only; no Rich or Live Preview control claims apply.
- Save state remains truthful for writable disk targets, imported copies, and download/export fallback targets.
- Line endings and unrelated bytes are preserved through source edits and save/export flow tests.
- Tests cover `.txt`, `.log`, `.json`, and unsupported binary/unknown extension routing.
- Visual impact: existing open/status/mode chrome may change labels or disabled states for lightweight files; no new visual styling pass is required unless the current UI cannot truthfully represent source-only files.

### Test-first plan

- RED: add document-kind classifier tests proving `.txt`, `.log`, and `.json` route to lightweight source documents while `.md` and `.html` keep their existing routes.
- RED: add demo/web open-mode tests proving lightweight text documents expose Source only and never claim Rich/Live Preview.
- RED: add save-truth/source-preservation tests for a plain text fixture with CRLF and non-Markdown characters.

### Implementation notes

Read first: `packages/md-adapter-web/src/index.ts`, `apps/md-demo/src/main.ts`, `packages/md-editor/src/index.ts`, `packages/md-surface/src/index.ts`, `packages/md-source-codemirror/src/index.ts`, `packages/md-save/src/index.ts`, `tests/web-file-access.test.mjs`, `tests/web-external-change.test.mjs`, `tests/demo-reference-surface-baseline.test.mjs`, and existing mode/status tests.

Keep this as a host/document-kind capability slice. Do not add syntax validators, code-formatters, CSV table previews, JSON tree views, SVG rendering, or Markdown conversion in this issue. Source mode remains CodeMirror; save truth remains Save Engine based.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation, unless visible routing/status wording requires product naming decisions.

### Reviewer

Architecture Reviewer, Test Reviewer, and UX Reviewer.

## MME-BACKLOG — Future split candidates

This is not a normal implementation issue and does not need the strict issue template. It is a holding area for product, UX, adapter, and DX ideas that should later be split into real MME issues when we decide to execute them.

### Editor UX / live preview

- Target at least Obsidian default Live Preview behavior, with real Markdown behind it.
- Keep Momentarise differentiation: toolbar, slash command, better structured block layer, and `.md` as source of truth.
- Source, Rich, and Live Preview editing ergonomics.
- Indentation/outdent with Tab/Shift+Tab.
- Nested bullet lists, ordered lists, and todos.
- Enter, Backspace, paste, selection, undo/redo around headings, lists, todos, quotes, code blocks, callouts, opaque blocks, inserted media, and document end.
- Live preview refresh for Markdown constructs typed in rich mode.
- Obsidian-like live preview for raw inline/block HTML inside Markdown where policy allows rendering, while preserving raw HTML in source.
- Block insertion affordances before/after framed blocks and at document end.

### Toolbar / slash / mode controls

- Slash menu placement, empty states, labels, grouping, keyboard navigation, and fuzzy matching.
- Slash `/ai` inline prompt surface: selecting AI from the slash menu should open a panel anchored under the current line/block with a focused free-text prompt box and action rows/buttons such as continue writing, draft, rewrite, improve, summarize, translate, checklist, and table.
- Toolbar visibility, density, contextual behavior, settings/host configuration, and command grouping.
- Source/Rich/Live Preview naming and transitions.
- Replace demo-style segmented mode buttons with an editor-grade compact toggle, icon button, status menu, or host-configurable mode picker.
- Mode controls must be document-kind aware: Markdown exposes relevant Source/Rich/Live Preview choices; HTML exposes Source/Preview without disabled/confusing Rich mode.
- Unify `Open .md` and `Open .html` into one Open action with type detection or a secondary menu/filter.
- Add a `New file` / `Save As` flow: browsers with File System Access can create a real writable `.md` file, while unsupported environments must clearly fall back to download/export copy without implying disk persistence.

### HTML preview / reading surface

- Remove permanent technical HTML status strip/banner from normal preview reading surface.
- Keep sandbox/script/save truth discoverable through a discreet status affordance, inspector, hover/detail menu, toast, or debug surface.
- Avoid nested/conflicting scroll regions and large blank preview gutters.
- Preview should use the available app viewport naturally for daily reading, not device/debug controls.

### Folding / document status

- Folding polish benchmarked against Obsidian/CodeMirror-style left-gutter affordances.
- Fold controls should live in a subtle editor gutter/margin, appear on hover/focus, avoid heavy borders/shadows, and use a minimal collapsed marker such as `...`.
- The permanent document metadata/status section must not remain normal editor chrome for any opened file type.
- Move file name, URI, adapter kind, writability, persistence target, and save details into an editor-grade status pattern while preserving save truthfulness.
- Evaluate optional bottom-right word/character counter that can be shown, hidden, or disabled by host/settings.

### Plain text and adjacent lightweight files

- Add `.txt` reading/import support as a lightweight source-mode document type.
- Consider `.text`, `.log`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, `.toml`, and similar text-like files as future source/preview candidates.
- Consider `.svg` as a future lightweight reader/preview candidate, with sanitized/sandboxed rendering before any inline display.
- Decide per extension whether the file is editable source, preview-only, import-to-Markdown, or adapter-specific.
- Keep Save Engine truthfulness: do not imply Markdown round-trip if the file is plain text or another syntax.

### Future document format adapters

- Track post-V0 support for `.docx`, `.pptx`, Google Docs, PDF, and similar document formats without weakening the `.md` source-of-truth contract.
- Define whether each format is preview-only, import-to-Markdown, export-from-Markdown, or true round-trip editable with a real format-preserving adapter.
- Keep conversion provenance and lossiness visible to users.
- Warn before overwrite/export if conversion may lose layout, comments, tracked changes, speaker notes, formulas, embedded media, or source-format semantics.
- Never claim an imported/converted document was saved back to the original source format unless the adapter actually did that.

### Public framework follow-ups (added 2026-06-09)

- Obsidian-parity Live Preview mode (must not start before MME-0019/MME-0020 land, or it inherits the same corruption path).
- Asset/upload provider contract for image paste and drag-drop (BlockNote `uploadFile`-style host contract; SaveTarget-pattern).
- LiteLLM / OpenAI-compatible AI provider adapter: optional host-side adapter for developer choice across OpenAI, Gemini, Mistral, Anthropic, local models, or any LiteLLM-routed provider. It must remain outside core and should prefer backend/sidecar/secure-storage/user-gateway patterns over direct production browser key exposure.
- Collaboration positioning: public statement that CRDT/collab is future work; the block-level targeted-edit invariant keeps the door open and must not be broken.
- Vue/Svelte bindings after `@momentarise/md-react` stabilizes.
- Optional settings UI components (headless settings state + reference DOM components); hosts keep owning settings presentation.
- VS Code/Cursor extension adapter (webview reusing the web build) and Chrome extension candidate.
- Desktop host shell (Electron and/or Tauri): OS file IO, secure key storage, OS `.md` file association, auto-update — all through SaveTarget-style capability contracts; no core changes.
- Vue and Svelte bindings (same shape as `md-react`), after the React binding stabilizes.
- Mobile/tablet host shell + the touch/layout pass (virtual-keyboard toolbar, touch selection, gestures).
- Note: vanilla/Vite/any-bundler and React/Next are NOT backlog adapters — they consume the framework-agnostic packages directly (vanilla) or via `md-react` (MME-0031). Only host SHELLS and additional framework bindings live here.
- Vim mode hook, typewriter/focus modes, word/character stats surface.
- Rich-mode live rendering of inline/block HTML inside Markdown where policy allows (render-sanitized; source preserved), beyond the MME-0032 read-only renderer.
- Link editing popover and docs-page link autocomplete (extends MME-0038 internal linking).
- Migration guides (from Tiptap, BlockNote, plain textarea) and StackBlitz example embeds.
- CMS publishing bridge research: Decap CMS and TinaCMS as interim Git-backed blog/admin bridges for templates; long-term MME-authored Markdown/blog flows publishing through Payload CMS with explicit source-of-truth and persistence boundaries.
- Payload CMS plugin/integration: future adapter/plugin that lets Payload-backed apps use MME as a Markdown-native content editor while preserving Markdown/YAML frontmatter truth, save/publish boundaries, permissions, draft/published state, and media handling explicitly.
- Mobile/tablet input pass: virtual-keyboard toolbar, touch selection, gesture affordances.
- Performance budgets and large-document benchmarks (10k-line documents; incremental parse/serialize; debounced status checks).

### Potential future splits

- Editor live preview parity.
- Toolbar/slash/menu final UX.
- Unified Open flow and file-type routing.
- New file / Save As flow with truthful writable-vs-export behavior.
- HTML preview reading polish.
- Plain text/lightweight file adapter.
- SVG reader / sanitized preview.
- Office/PDF/Google Docs adapter research.
- Payload CMS plugin/integration.
- Document status/save truth UI.
- Inline slash AI prompt surface.
- LiteLLM / OpenAI-compatible AI provider adapter.
