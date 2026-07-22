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

Accepted for code continuation 2026-07-19 after adding a reusable `@momentarise/md-core` document-kind classifier for Markdown, standalone HTML artifacts, lightweight source files, and unsupported files; re-exporting classifier helpers through `@momentarise/md-editor`; extending surface mode contracts so lightweight source documents expose Source only; and routing web/demo open, import, Save As, fallback, and unsupported paths through truthful document-kind and save-target states. Lightweight source files preserve source line endings through writable and imported-copy paths and do not run Markdown parser/serializer/status claims. Unsupported file names no longer fall back to Markdown, including generic `text/plain` on known unsupported extensions. Public package/import-export docs, `llms-full.txt`, generated AX artifacts, and public API fixtures were updated. Proven by RED `npm run test:lightweight-source-files`, green targeted checks, `git diff --check`, and full `npm test`. Architecture/API reviewer subagent `Arendt` used `gpt-5.3-codex-spark` with `xhigh` reasoning and reported no P0/P1/P2 findings; builder fixed the P3 unsupported fallback and reviewer recheck found no remaining P0-P3 findings. Save/UX reviewer subagent `Singer` used `gpt-5.3-codex-spark` with `xhigh` reasoning and reported no P0/P1/P2 findings; builder fixed the P3 properties-panel source-only regression and reviewer recheck found no remaining P0-P3 findings. Final lightweight source UX/product review is queued in `docs/internal/BACKLOG.md`; no executable normal issue remains after MME-0052 until the next backlog item is promoted.

## MME-0053 — SVG source reader and sanitized preview

### Goal

Add truthful standalone `.svg` file handling as a visual artifact source: users can inspect/edit the SVG source and preview a sanitized rendering without allowing scripts, event handlers, external references, or Markdown/source-format confusion.

### Scope

- Classify `.svg` as a standalone SVG artifact/document kind, distinct from Markdown, HTML artifacts, and lightweight source text.
- Open/import `.svg` files through web/demo routing with truthful source, preview, writable/imported-copy, and unsupported fallback states.
- Provide a reusable sanitized SVG preview helper that removes script execution, inline event handlers, active content, and external network references before rendering.
- Keep Source and Preview mode availability document-kind aware; do not expose Rich or Live Preview for standalone SVG artifacts.
- Preserve SVG source bytes for source editing and save/export paths; the sanitized preview is an artifact only and must not overwrite the source.
- Document SVG artifact boundaries in public import/export and package docs.
- Queue final visible/product review for the preview chrome and wording instead of blocking code continuation.

### Acceptance criteria

- Public package exports or documented helpers classify `.svg` separately from Markdown, HTML artifact, lightweight source, and unsupported files.
- Opening/importing `.svg` produces source editing plus a sanitized Preview path, not Markdown parsing or rich editing.
- Sanitization tests prove scripts, `on*` handlers, `javascript:` URLs, external `href`/`src`, foreignObject, and remote CSS/image references do not execute or survive in the preview artifact.
- Save truth remains unchanged: writable disk targets write source only; imported copies require export/download; preview sanitization never marks the source saved.
- Tests prove source bytes and line endings survive open/edit/save/export paths.
- Visual impact is documented. If screenshot tooling is available, capture the SVG Source/Preview path; otherwise mark final SVG preview product review in `docs/internal/BACKLOG.md`.

### Test-first plan

- RED: add SVG classifier/mode tests proving `.svg` routes to SVG artifact, Source/Preview only, with Markdown/Rich/Live Preview unavailable.
- RED: add sanitizer tests with hostile SVG samples covering scripts, event handlers, external references, `javascript:` URLs, CSS/imports, images, and `foreignObject`.
- RED: add web/demo routing tests proving SVG open/import/save truth and no Markdown parser/serializer claims.

### Implementation notes

Read first: `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-surface/src/index.ts`, `packages/md-preview-html/src/index.ts`, `packages/md-adapter-web/src/index.ts`, `apps/md-demo/src/main.ts`, `tests/html-preview.test.mjs`, `tests/demo-html-preview-baseline.test.mjs`, `tests/lightweight-source-files.test.mjs`, `tests/web-file-access.test.mjs`, and public docs around import/export and HTML artifact preview.

Keep this as a standalone SVG artifact reader/preview. Do not implement inline SVG rendering inside Markdown, image upload/storage, SVG editing tools, raster export, external resource fetching, full SVG optimization, or document conversion in this slice.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Security Reviewer, Architecture Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation, unless sanitizer policy, external reference behavior, or visible preview product wording needs a product/security decision.

### Reviewer

Security Reviewer, Architecture Reviewer, and Test Reviewer.

### Status: completed

Accepted for code continuation 2026-07-19 after adding standalone `svg-artifact` classification, Source/Preview-only surface routing, web/demo open/import/save truth for writable and imported-copy paths, a reusable sanitized SVG preview helper with a DOM allowlist sanitizer, hostile SVG regression coverage, public docs/API updates, and runtime visual proof. Proven by RED `npm run test:svg-preview`, green targeted checks, `npm run visual:mme-0053`, `git diff --check`, and full `npm test`. Architecture/API reviewer subagent `Hume` used `gpt-5.3-codex-spark` with `xhigh` reasoning and reported no findings. Security reviewer subagent `Mencius` initially found sanitizer and wording risks; builder replaced regex sanitization with a DOM allowlist sanitizer, tightened conservative wording, and re-review reported no remaining findings. Test reviewer subagent `Ampere` initially found routing, sanitizer-corpus, surface/web matrix, and docs-trace gaps; builder added regression coverage and runtime visual proof, and re-review reported no remaining findings. Final SVG preview UX/product review is queued in `docs/internal/BACKLOG.md`; no executable normal issue remains after MME-0053 until the next backlog item is promoted.

## MME-0054 — Visible asset upload UX and demo provider

### Goal

Make the existing host-owned asset upload contract visible and usable in the reference demo through paste/drop/command flows, while keeping storage host-owned, source-preserving, and truthful about pending, denied, unavailable, failed, and inserted results.

### Scope

- Add a minimal reusable surface/action contract for visible asset insertion state, labels, disabled reasons, and result messaging.
- Wire the demo to the existing `session.insertAsset` path through toolbar/slash or visible action entry points plus paste/drop scenarios where practical.
- Add a local demo asset provider that returns safe Markdown image destinations without introducing framework-owned storage, cloud SDKs, or hidden asset databases.
- Preserve Markdown source bytes around inserted image syntax and keep save truth unchanged after insertion.
- Show truthful UI feedback for unavailable provider, policy denial, provider failure, pending result, unsafe URL, and successful insertion.
- Document the host-owned storage boundary and queue final upload UX/product review instead of blocking code continuation.

### Acceptance criteria

- The reference demo exposes a visible image/asset insertion path instead of keeping `session.insertAsset` test-only.
- Paste/drop-like image inputs and command-triggered insertion route through the same provider contract, policy checks, and Markdown image serializer as MME-0051.
- Successful insertion adds normal Markdown image syntax at the intended source/rich selection without rewriting unrelated Markdown.
- Missing provider, policy denial, provider failure, pending result, and unsafe provider URL produce truthful UI/event states and leave the document unchanged.
- Demo provider output is local/demo-scoped and clearly not a production storage default.
- Automated tests prove the visible/demo path calls the reusable contract and preserves save truth.
- Visual verification captures the visible upload entry point, success state, and at least one non-inserted error/denied state.

### Test-first plan

- RED: add a demo/surface asset upload UX test proving a visible image action exists and routes through `session.insertAsset`.
- RED: add paste/drop-like demo tests with fake image file inputs proving success, denied/unavailable/failed/pending results, and no mutation on non-inserted paths.
- RED: add preservation/save-truth checks proving inserted image syntax changes only the intended range and leaves save state honest.

### Implementation notes

Read first: `packages/md-editor/src/index.ts`, `packages/md-surface/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-react/src/index.ts`, `apps/md-demo/src/main.ts`, `tests/asset-upload-provider.test.mjs`, `tests/demo-reference-surface-baseline.test.mjs`, `tests/rich-commands.test.mjs`, `tests/demo-commands.test.mjs`, `tests/demo-rich-ux.test.mjs`, public docs around editor UI, Document Access Policy, and import/export.

Keep this as a visible framework/demo integration of the existing host-owned contract. Do not add real hosted uploads, cloud storage SDKs, production storage defaults, a media library, image optimization, drag/drop layout overhaul, or user account/storage configuration in this slice.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: UX Reviewer, Architecture Reviewer, Security Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; visible upload UX/product review remains queued for the end-of-run human review block unless a storage/privacy/security decision is needed.

### Reviewer

UX Reviewer, Architecture Reviewer, Security Reviewer, and Test Reviewer.

### Status: completed

Accepted for code continuation 2026-07-20 after adding a visible Insert image action, slash/paste/drop routing through `session.insertAsset`, localized reusable upload state, a clearly demo-scoped relative-path provider, exact source and rich-position insertion, stale upload rejection, and truthful unavailable/denied/failed/pending/unsafe feedback. Proven by RED race/i18n checks, green targeted tests, real browser event and screenshot verification, `git diff --check`, and full `npm test`. UX/accessibility, architecture/security, and test/preservation reviewer subagents used `gpt-5.3-codex-spark` with `xhigh` reasoning; builder fixed their async race, transfer discovery, i18n, rich mapping, policy-fixture, byte-integrity, and runtime-proof findings, and all three final re-reviews reported no remaining P0-P3 findings. Final upload product/wording review is queued in `docs/internal/BACKLOG.md`; no executable normal issue remains after MME-0054 until the next backlog item is promoted.

## MME-0055 — Rich GFM table editing baseline

### Goal

Make standard GFM pipe tables directly editable in Rich mode without weakening Markdown source preservation or pretending MME is a spreadsheet.

### Scope

- Map safely representable top-level GFM table, row, header-cell, and body-cell nodes into an editable rich table model.
- Keep nested tables source-only until nested-range serialization can replace only table bytes without rewriting blockquote/list container syntax.
- Keep malformed, non-standard, or non-representable table-like syntax as the existing opaque/source-only fallback.
- Support editing existing cell text plus conventional Tab and Shift+Tab cell navigation; Tab from the final cell may add one Markdown-representable row.
- Serialize a changed rich table back into valid GFM Markdown while limiting replacement to that table's source range and preserving every unrelated source byte.
- Preserve untouched supported tables byte-for-byte through rich mount and serialize.
- Expose reusable rich-table commands/helpers through `@momentarise/md-rich-prosemirror`; keep demo wiring thin and package-owned behavior reusable.
- Add runtime visual proof for editing and navigating a table in the reference demo, with final product/taste review queued for the end-of-run human review block.

### Acceptance criteria

- A supported top-level GFM table mounts as editable rich table nodes instead of the preserved-table fallback.
- Nested tables remain an explicit byte-identical source-only fallback.
- Editing one cell produces valid GFM Markdown, preserves table shape/alignment semantics, and does not rewrite source outside the edited table range.
- Untouched supported tables remain byte-identical through rich round-trip.
- Malformed/non-standard table-like syntax remains opaque, visibly source-only, and byte-identical.
- Tab and Shift+Tab navigate cells predictably; final-cell Tab behavior cannot create a non-Markdown table shape.
- Source/Rich switching, undo/redo, Save Engine hashes, and autosave remain truthful after a table edit.
- Automated tests cover supported editing, untouched identity, malformed fallback, navigation, targeted serialization, and save truth.
- Browser verification captures the editable table state and a completed cell edit at desktop and constrained widths.

### Test-first plan

- RED: add rich table tests proving a supported GFM table currently mounts as `unsupported_block` instead of editable table nodes.
- RED: add a cell-edit and targeted-serialization test proving only the table source range may change.
- RED: add Tab/Shift+Tab navigation and final-cell behavior tests.
- RED: add malformed-table regression proof so expanded table support cannot absorb opaque syntax.

### Manual verification

- Start the reference demo, open the standard table fixture, switch to Rich, edit a cell, navigate with Tab/Shift+Tab, undo/redo, switch to Source, and confirm valid Markdown plus truthful dirty/save state.
- Capture desktop and constrained-width artifacts under `docs/internal/visual-checks/MME-0055/`.

### Visual impact

Supported GFM tables become real editable rich tables. Malformed/non-standard tables retain the existing preserved-source fallback. Final table styling and product taste review remains queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/package.json`, `apps/md-demo/src/main.ts`, `fixtures/004-gfm-table`, `fixtures/019-gfm-table-variants`, `tests/rich-roundtrip-fidelity.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/rich-core-interactions.test.mjs`, `tests/rich-commands.test.mjs`, and the MME-0040 visual/test artifacts.

Prefer the established ProseMirror table primitives when their license and package boundary fit the repository. Do not hand-roll table selection/navigation behavior that a proven library already provides. Keep view-engine dependencies in `@momentarise/md-rich-prosemirror`; no ProseMirror dependency may enter core/model/service packages.

Do not add merged cells, column resizing, spreadsheet formulas, CSV/spreadsheet paste, sorting/filtering, drag-reorder UI, full row/column menus, table creation UX, or arbitrary block content inside cells in this slice.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible table UX/product review is queued for the end-of-run human review block unless a dependency, license, or Markdown-serialization decision becomes unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, and UX Reviewer.

### Status: completed

Accepted for code continuation 2026-07-20 after adding editable standard top-level GFM tables, reusable cell selection/movement/edit helpers, table-range-only Markdown serialization, untouched-byte identity, CRLF preservation, malformed/nested source-only fallback, Markdown-safe final-row insertion, truthful undo/redo/save behavior, and real browser keyboard/focus/constrained-width proof. `prosemirror-tables` is isolated to the rich package and uses its MIT license. Architecture/security, test/preservation, and UX/accessibility reviewer subagents used `gpt-5.3-codex-spark` with `xhigh` reasoning; builder fixed their nested-range boundary, save-proof, keyboard-event, false-dirty, responsive-overflow, and focus-indicator findings, and all final re-reviews reported no remaining P0-P3 findings. Final table UX/product review is queued in `docs/internal/BACKLOG.md`; nested table editing and advanced spreadsheet-like controls remain future work.

## MME-0056 — Rich GFM footnote definition editing baseline

Accepted for code continuation 2026-07-20 after adding semantic rich footnote references, editable unique top-level single-line definitions, exact prefix and targeted source-range serialization, recursive duplicate exclusion, and explicit source-only fallbacks for multi-line, multi-block, nested, unsafe, duplicate, and malformed definitions. Reusable selection/replacement helpers, CRLF preservation, undo/redo, post-undo save truth, public API/docs updates, real browser input, Source/Rich switching, and desktop/constrained visual proof are covered. Architecture/security, preservation/test, and UX/accessibility reviewers used `gpt-5.3-codex-spark` with `xhigh` reasoning; builder fixed identifier-normalization, prefix-fidelity, and nested-duplicate findings, and all final reviews reported no remaining P0-P3 findings. Final footnote label density, reference semantics/navigation, keyboard focus treatment, fallback wording, and product taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0056 until the next backlog item is promoted.

### Goal

Make safely representable existing GFM footnote definitions directly editable in Rich mode while preserving references, complex definitions, and unrelated Markdown exactly.

### Scope

- Map supported top-level single-paragraph GFM footnote definitions into a semantic editable rich node with an explicit identifier label.
- Keep multi-line, multi-block, nested, duplicate, malformed, unsafe, or otherwise non-representable footnote definitions in the existing source-only fallback.
- Keep GFM footnote references semantic and Markdown-representable in rich paragraphs without turning them into plain lossy text.
- Support selecting an existing simple definition and replacing its single-line body text through reusable `@momentarise/md-rich-prosemirror` helpers.
- Serialize a changed simple definition back to valid `[^identifier]: body` Markdown while replacing only that definition's source range and preserving every unrelated source byte and line ending.
- Preserve untouched supported references and definitions byte-for-byte through rich mount and serialize.
- Keep identifier rename, new footnote insertion, complex definition editing, drag reordering, and rendered backlink UX out of this first editing slice.
- Add runtime visual proof for editing a simple definition and retaining complex definition fallbacks, with final product/taste review queued for Andrew's end-of-run review block.

### Acceptance criteria

- A supported top-level single-paragraph footnote definition mounts as a semantic editable rich node instead of an opaque fallback.
- A rich footnote reference retains its identifier semantics and serializes as valid `[^identifier]` syntax after a neighboring paragraph edit.
- Replacing one supported definition body produces valid GFM Markdown and does not rewrite source outside that definition range.
- Untouched supported references and definitions remain byte-identical through rich round-trip.
- Multi-line, multi-block, nested, duplicate, malformed, unsafe, or non-representable definitions remain visibly source-only and byte-identical.
- Source/Rich switching, undo/redo, Save Engine hashes, and autosave remain truthful after a definition edit.
- Public rich-footnote helper exports are intentional, package-owned, documented, and covered by the public API audit.
- Browser verification captures editable and edited definition states plus the preserved complex fallback at desktop and constrained widths.

### Test-first plan

- RED: add a focused fixture/test proving a simple top-level definition currently mounts as `unsupported_block` instead of an editable semantic node.
- RED: add definition-body edit and targeted-serialization proof that only the selected definition range changes.
- RED: add reference-semantics and neighboring-paragraph edit proof.
- RED: add multi-line/duplicate/malformed fallback and save-truth regressions.

### Manual verification

- Start the reference demo, open the footnote fixture, switch to Rich, edit the supported simple definition, undo/redo, switch to Source, and confirm valid Markdown plus truthful dirty/save state.
- Confirm complex, duplicate, and malformed definitions remain clearly source-only.
- Capture desktop and constrained-width artifacts under `docs/internal/visual-checks/MME-0056/`.

### Visual impact

Supported simple footnote definitions become labeled editable rich blocks. Complex and unusual definitions retain the preserved-source fallback. Final label density, focus treatment, and footnote product taste review remains queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/020-gfm-footnotes`, `tests/parser-foundation.test.mjs`, `tests/rich-roundtrip-fidelity.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/render-html.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0041 build-log/visual artifacts.

Use the existing parser source ranges and rich targeted-serialization machinery. Do not normalize unrelated reference spelling or definition indentation. Keep view-engine behavior in `@momentarise/md-rich-prosemirror`; no ProseMirror dependency may enter core/model/service packages.

Do not add identifier rename, automatic reference repair, new footnote insertion UI, rich multi-block definition editing, nested definition editing, footnote reorder UI, hover previews, or renderer/backlink redesign in this slice.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible footnote UX/product review is queued for the end-of-run human review block unless a Markdown-serialization or identifier-semantics decision becomes unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, and UX Reviewer.

## MME-0057 — Rich GFM footnote insertion baseline

### Status: completed

Accepted for code continuation 2026-07-20 after adding a package-owned semantic footnote insertion helper and command, deterministic normalization-aware identifiers, exact reference and document-end definition materialization, same-paragraph multiple insertion, backslash-escaped source mapping, conservative entity/stale/unmappable refusal, LF/CRLF preservation, one-step undo/redo, truthful save state, public API/docs coverage, and real browser command/source/constrained-width proof. Architecture, preservation/test, and security/accessibility reviewers used `gpt-5.3-codex-spark` with `xhigh` reasoning; builder fixed same-paragraph insertion, escaped-source mapping, adversarial preservation coverage, empty-document mapping, and command-diagnostic findings. Final re-review reported no remaining P0-P3 findings. Final command placement, naming, generated identifiers, focus flow, source visibility, and constrained-layout product review remains queued in `docs/internal/BACKLOG.md` for Andrew's end-of-run block. Identifier rename, automatic repair, and complex definition editing remain future work.

### Goal

Let users insert a new Markdown-native footnote reference and matching simple definition from Rich mode without full-document serialization, identifier collisions, or hidden non-Markdown state.

### Scope

- Add a reusable `@momentarise/md-rich-prosemirror` command/helper that inserts one semantic footnote reference at a safely mappable rich selection and one matching top-level single-line definition.
- Allocate a deterministic collision-free identifier from an optional preferred identifier or a documented default, using the same normalization rules as parser diagnostics and rich-definition eligibility.
- Insert only valid GFM `[^identifier]` and `[^identifier]: body` source syntax; keep Markdown as the only durable footnote state.
- Apply the insertion as bounded source patches for the reference position and document-end definition, preserving every unrelated byte and the document line-ending convention.
- Reject unsupported selections, duplicate/colliding identifiers, unsafe/non-representable initial body content, stale documents, and unmappable rich positions without mutating source.
- Expose the command through the existing package-owned command surface and reference demo with localized accessible state.
- Keep existing complex, nested, duplicate, malformed, and non-representable definitions source-only.
- Add runtime browser proof for keyboard-first insertion, source visibility, undo/redo, save truth, and constrained-width containment; queue final product/taste review for Andrew's end-of-run block.

### Acceptance criteria

- Inserting a footnote from a supported rich text selection creates one semantic reference and one matching top-level simple definition using valid GFM Markdown.
- Generated identifiers are deterministic, normalization-aware, and never collide with existing references or definitions.
- A caller-supplied invalid or colliding preferred identifier produces a truthful non-mutating result.
- Only the reference insertion point and appended definition region change; all pre-existing source bytes remain exact.
- LF and CRLF documents retain their line-ending convention, including the appended definition separator.
- Unsupported or unmappable selections fail safely and leave source, history, dirty state, and save hashes unchanged.
- One undo removes both inserted source regions as one user action; redo restores them; Save Engine and autosave remain truthful.
- Slash/command invocation is keyboard reachable, localized, and does not depend on demo-only document mutation.
- Public helper exports are intentional, package-owned, documented, and covered by the public API audit.
- Browser verification captures pre-insertion, inserted Rich, resulting Source, and constrained-width states.

### Test-first plan

- RED: add focused rich-footnote insertion tests that fail because no reusable insertion export exists.
- RED: prove deterministic identifier allocation, normalization-aware collision handling, and invalid preferred-identifier rejection.
- RED: prove two-range targeted insertion, unrelated-byte identity, LF/CRLF behavior, single-step undo/redo, and save truth.
- RED: add command-surface/demo tests for keyboard invocation plus unmappable/stale non-mutation.

### Manual verification

- Start the reference demo, place the caret in a normal rich paragraph, invoke Insert footnote from the command surface, and confirm one reference plus one editable definition appears.
- Undo once, redo once, save, switch to Source, and confirm valid GFM Markdown plus truthful clean/dirty state.
- Repeat in a constrained viewport and capture artifacts under `docs/internal/visual-checks/MME-0057/`.

### Visual impact

The command surface gains an Insert footnote action and Rich mode gains the inserted semantic reference/definition state. Final action placement, generated-label wording, focus transfer, and visual density review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `tests/extension-registry.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/rich-commands.test.mjs`, `tests/demo-slash-toolbar-baseline.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056 build-log/visual artifacts.

Reuse the parser/rich identifier normalization and source-position mapping already established by MME-0041/MME-0056. Treat reference-plus-definition insertion as one history transaction even though serialization touches two bounded source regions. Keep ProseMirror behavior isolated to `@momentarise/md-rich-prosemirror`; no view-engine dependency may enter core/model/save/policy packages.

Do not add identifier rename, automatic repair of missing references or duplicate definitions, rich multi-line/multi-block/nested definition editing, definition reorder, hover previews, renderer/backlink redesign, or docs-content construction in this slice.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible footnote insertion UX/product review is queued for the end-of-run human review block unless identifier or serialization semantics remain unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, and UX Reviewer.

## MME-0058 — Rich GFM footnote identifier rename baseline

### Goal

Let hosts rename one safely representable GFM footnote identifier and every matching semantic reference from Rich mode without collisions, partial repair, hidden state, or unrelated Markdown rewrites.

### Scope

- Add a reusable `@momentarise/md-rich-prosemirror` helper that renames one unique editable footnote definition and every matching semantic reference in one history transaction.
- Match identifiers with the parser's normalization rules while preserving exact source spelling outside the identifier tokens being changed.
- Validate the requested identifier with the same safe-identifier contract used by parsing, editing eligibility, and insertion.
- Reject missing definitions, duplicate/ambiguous definitions, invalid identifiers, normalized collisions, stale source, and any unmappable reference or definition before mutation.
- Rewrite only the identifier token inside each matching `[^identifier]` reference and the matching definition prefix; preserve definition body, indentation, spacing, line endings, and all unrelated bytes exactly.
- Keep Markdown as the only durable rename state; ProseMirror attributes and command metadata remain derived.
- Expose truthful identifier/reason metadata for host command handling without requiring demo-only persistence logic.
- Add runtime browser proof for multi-reference rename, single-step undo/redo, Source visibility, save truth, and constrained-width containment; queue final product/taste review for Andrew's end-of-run block.

### Acceptance criteria

- Renaming a supported unique definition updates that definition and every normalized matching semantic reference to one valid GFM identifier.
- The definition body and exact prefix whitespace/indentation survive; only old identifier-token ranges and any explicitly appended insertion metadata change.
- A requested identifier that is invalid or collides with another reference/definition refuses truthfully and leaves source/history/save state unchanged.
- Missing, duplicate, stale, partially unmappable, complex, nested, malformed, or source-only definitions never receive a partial rename.
- LF and CRLF documents retain their original line-ending convention and unrelated bytes, including unknown HTML/directive syntax.
- One undo reverts all renamed tokens as one user action; redo restores them; Save Engine/autosave hashes and persisted content remain truthful.
- Public helper exports are intentional, package-owned, minimally documented, and covered by the public API audit.
- Browser verification captures renamed Rich, resulting Source, and constrained-width states with multiple references.

### Test-first plan

- RED: add focused rename tests that fail because no reusable `renameRichFootnoteIdentifier` export exists.
- RED: prove normalized multi-reference rename, exact definition-prefix preservation, collision/invalid/missing/duplicate refusal, and no partial mutation.
- RED: prove hostile surrounding syntax identity, LF/CRLF behavior, one-step undo/redo, and save truth.
- RED: add host-command metadata and browser runtime checks for renamed Rich/Source state.

### Manual verification

- Start the reference demo with one supported definition referenced multiple times, select/target that definition, and invoke the reusable rename path.
- Confirm every matching Rich reference and the definition label update together, undo once, redo once, save, then switch to Source and inspect exact GFM Markdown.
- Repeat in a constrained viewport and capture artifacts under `docs/internal/visual-checks/MME-0058/`.

### Visual impact

Semantic Rich references and their editable definition label can display a renamed identifier together. This slice proves the resulting state and host command path; final rename entry-point placement, input flow, wording, focus transfer, and visual density remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/rich-commands.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056/MME-0057 build-log and visual artifacts.

Reuse the semantic reference/definition nodes, parser normalization, source ranges, and insertion baseline materialization already established by MME-0041/MME-0056/MME-0057. Validate every affected source token before creating the single transaction; never rename a safe subset while leaving another matching reference stale. Keep all ProseMirror behavior inside `@momentarise/md-rich-prosemirror`.

Do not add automatic repair of missing definitions/references, rich multi-line/multi-block/nested definition editing, definition reorder, hover previews, renderer/backlink redesign, polished rename-dialog UI, or docs-content construction in this slice.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible rename UX/product review is queued for the end-of-run human review block unless identifier or serialization semantics remain unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, and UX Reviewer.

## MME-0059 — Rich multiline GFM footnote definition editing baseline

### Goal

Let users edit safely representable top-level multiline GFM footnote definitions from Rich mode while preserving Markdown structure, source-only fallbacks, history, and save truth.

### Scope

- Extend the rich footnote definition model to represent one unique top-level definition whose body is a single paragraph continued across indented Markdown lines.
- Preserve the definition identifier, first-line prefix, continuation indentation, line-ending convention, and unrelated source bytes.
- Map the represented definition back to one bounded source range and serialize edits without a full-document rewrite.
- Keep blank-line-separated multi-paragraph definitions, nested block constructs, container-nested definitions, duplicates, malformed definitions, unsafe content, and unmappable source in explicit source-only fallback.
- Keep semantic references, insertion, and identifier rename compatible with the expanded editable definition.
- Treat each multiline definition edit as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for Rich editing, undo/redo, Source visibility, save truth, fallback visibility, and constrained-width containment.
- Queue final product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- A unique top-level GFM definition with one logical paragraph across indented continuation lines is editable as one semantic Rich definition.
- Editing its body changes only the bounded definition source range; all surrounding Markdown, unknown syntax, references, and unrelated definitions remain byte-identical.
- Definition identifier spelling, first-line prefix spacing, continuation indentation, and LF/CRLF convention remain valid and deterministic after serialization.
- One undo reverts the complete multiline edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing simple-definition editing, insertion, identifier rename, semantic references, and read rendering remain compatible.
- Blank-line multi-paragraph, nested-block, nested-container, duplicate, malformed, unsafe, stale, or unmappable definitions remain source-only and never receive partial edits.
- Public exports and schema changes are intentional, package-owned, minimally documented, and covered by API/contract tests.
- Browser verification captures multiline Rich before/after, resulting Source, complex fallback, and constrained-width states.

### Test-first plan

- RED: add focused multiline-footnote tests that fail because continuation-line definitions are still source-only.
- RED: prove bounded serialization, indentation/line-ending preservation, hostile surrounding syntax identity, one-step undo/redo, and save truth.
- RED: prove multi-paragraph/nested/duplicate/malformed/stale definitions refuse safely without partial mutation.
- RED: prove insertion and identifier rename still work against an editable multiline definition.
- RED: add browser/runtime checks for multiline Rich editing, Source output, fallback visibility, and constrained layout.

### Manual verification

- Start the reference demo with a supported continuation-line definition and a separate unsupported multi-paragraph definition.
- Edit the supported definition in Rich mode, undo once, redo once, save, then switch to Source and inspect exact GFM Markdown plus clean state.
- Confirm the unsupported definition remains visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0059/`.

### Visual impact

Supported continuation-line definitions become semantic editable Rich blocks instead of source-only fallback. Unsupported complex forms remain explicit fallback. Final density, continuation-line presentation, fallback wording, focus flow, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056/MME-0057/MME-0058 build-log and visual artifacts.

Reuse parser normalization, semantic reference/definition nodes, source-token ranges, targeted source materialization, and conservative eligibility checks established by MME-0041/MME-0056/MME-0057/MME-0058. Keep ProseMirror behavior inside `@momentarise/md-rich-prosemirror`; parser/source concerns stay in `@momentarise/md-format`. No core/model/save/policy package may depend on the view engine.

Do not add blank-line multi-paragraph or nested-block rich editing, nested-container definitions, automatic missing-reference repair, definition reorder, hover previews, renderer/backlink redesign, polished footnote dialogs, or docs-content construction in this slice.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible multiline-footnote UX/product review is queued for the end-of-run human review block unless preservation semantics remain unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, and UX Reviewer.

## MME-0060 — Rich multi-paragraph GFM footnote definition editing baseline

Accepted for code continuation 2026-07-21 after adding semantic paragraph children for unique top-level plain-paragraph definitions, exact per-paragraph source/layout retention, bounded changed-paragraph serialization, conservative nested-block/unsafe/duplicate/stale/unmappable refusal, compatible selection/replacement/insertion/rename behavior, truthful history/save state, public docs/AX artifact updates, real browser proof, fallback review, and full test pass. Requested `gpt-5.3-codex-spark` xhigh reviewers hit the usage limit and no substitute model was used; documented fallback review removed exact-source metadata from rendered DOM before final verification and found no remaining P0-P3 issue. Final paragraph spacing, definition density, fallback wording, full-editor focus outline, technical-diagnostics placement, Source visibility, and constrained-layout taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0060 until the next backlog item is promoted.

### Goal

Let users edit safely representable top-level multi-paragraph GFM footnote definitions from Rich mode while preserving Markdown paragraph boundaries, source-only fallbacks, history, and save truth.

### Scope

- Extend the rich footnote definition model to represent one unique top-level definition whose body contains two or more plain paragraphs separated by blank Markdown lines.
- Preserve the definition identifier, first-line prefix, continuation indentation, blank-line structure, line-ending convention, and unrelated source bytes.
- Map the represented definition back to one bounded source range and serialize paragraph edits without a full-document rewrite.
- Keep nested block content such as lists, blockquotes, code blocks, tables, callouts, raw HTML, and other non-paragraph structures source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, and unmappable source in explicit source-only fallback.
- Keep simple definitions, continuation-line definitions, semantic references, insertion, and identifier rename compatible with the expanded editable definition.
- Treat each multi-paragraph definition edit as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for Rich editing, undo/redo, Source visibility, save truth, fallback visibility, and constrained-width containment.
- Queue final product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- A unique top-level GFM definition with two or more representable paragraph children is editable as one semantic Rich definition.
- Editing one paragraph changes only the bounded definition source range; all other definition paragraphs, surrounding Markdown, unknown syntax, references, and unrelated definitions remain byte-identical where not intentionally reconstructed inside that edited range.
- Definition identifier spelling, first-line prefix spacing, continuation indentation, blank-line paragraph separation, and LF/CRLF convention remain valid and deterministic after serialization.
- One undo reverts the complete paragraph edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing single-line and continuation-line definition editing, insertion, identifier rename, semantic references, and read rendering remain compatible.
- Nested-block, nested-container, duplicate, malformed, unsafe, stale, or unmappable definitions remain source-only and never receive partial edits.
- Public exports and schema changes are intentional, package-owned, minimally documented, and covered by API/contract tests.
- Browser verification captures multi-paragraph Rich before/after, resulting Source, nested-block fallback, and constrained-width states.

### Test-first plan

- RED: add a focused multi-paragraph footnote fixture and tests that fail because the supported definition is still source-only.
- RED: prove bounded serialization, paragraph separation, indentation/line-ending preservation, hostile surrounding syntax identity, one-step undo/redo, and save truth.
- RED: prove nested-block, nested-container, duplicate, malformed, unsafe, stale, and unmappable definitions refuse safely without partial mutation.
- RED: prove simple/continuation editing, insertion, and identifier rename still work against an editable multi-paragraph definition.
- RED: add browser/runtime checks for multi-paragraph Rich editing, Source output, fallback visibility, and constrained layout.

### Manual verification

- Start the reference demo with a supported multi-paragraph definition and a separate unsupported nested-block definition.
- Edit the second supported paragraph in Rich mode, undo once, redo once, save, then switch to Source and inspect exact GFM Markdown plus clean state.
- Confirm the nested-block definition remains visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0060/`.

### Visual impact

Supported multi-paragraph definitions become semantic editable Rich blocks instead of source-only fallback. Unsupported nested-block forms remain explicit fallback. Final paragraph spacing, definition density, fallback wording, focus flow, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/023-multiline-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-footnote-multiline.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056/MME-0057/MME-0058/MME-0059 build-log and visual artifacts.

Reuse parser paragraph children, semantic reference/definition nodes, source-token ranges, targeted source materialization, and conservative eligibility checks established by MME-0041/MME-0056/MME-0057/MME-0058/MME-0059. Keep ProseMirror behavior inside `@momentarise/md-rich-prosemirror`; parser/source concerns stay in `@momentarise/md-format`. No core/model/save/policy package may depend on the view engine.

Do not add nested-list, blockquote, code-block, table, callout, raw-HTML, or arbitrary nested-block rich editing; container-nested definitions; automatic missing-reference repair; definition reorder; hover previews; renderer/backlink redesign; polished footnote dialogs; or docs-content construction in this slice.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible multi-paragraph footnote UX/product review is queued for the end-of-run human review block unless preservation semantics remain unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0059 established the continuation indentation, exact range, history, save, and browser-proof foundation required by this slice.

## MME-0061 — Rich list-block GFM footnote definition editing baseline

Accepted for code continuation 2026-07-21 after adding semantic paragraph plus bullet/ordered-list children for unique top-level safe definitions, exact unchanged-child source retention, bounded deterministic reconstruction of changed list blocks, ordered-start/container-indent/LF/CRLF preservation, conservative nested/task/loose/unsafe/duplicate/stale/unmappable refusal, compatible selection/replacement/insertion/rename behavior, truthful history/save state, package docs, real browser proof, fallback review, and full test pass. Requested `gpt-5.3-codex-spark` xhigh reviewers hit the usage limit and no substitute model was used; documented fallback review found and fixed the missing fixture expectations required by the CLI corpus gate, then found no remaining P0-P3 issue. Final list indentation, marker density, definition spacing, fallback wording, full-editor focus outline, technical-diagnostics placement, Source visibility, and constrained-layout taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0061 until the next backlog item is promoted.

### Goal

Let users edit safely representable standard list blocks inside unique top-level GFM footnote definitions while preserving Markdown container indentation, unrelated definition blocks, source-only fallbacks, history, and save truth.

### Scope

- Extend the semantic rich footnote definition model to represent plain paragraphs plus standard bullet or ordered list blocks.
- Limit editable lists to list items containing exactly one representable plain paragraph; retain list marker/order semantics through package-owned ProseMirror list nodes.
- Preserve the definition identifier, first-line prefix, block separators, footnote container indentation, line endings, unchanged sibling block bytes, and unrelated source bytes.
- Reconstruct one changed list block only inside the bounded definition range; keep the complete Markdown document and every unchanged definition child source-preserved.
- Keep simple, continuation-line, multi-paragraph, insertion, whole-body replacement, definition selection, semantic references, and identifier rename behavior compatible.
- Keep nested lists, task lists, multi-paragraph list items, loose or mixed complex lists, blockquotes, code blocks, tables, callouts, raw HTML, and arbitrary nested structures source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, stale source, and unmappable ranges in explicit source-only fallback.
- Treat one list-item text edit as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for supported list editing, undo/redo, Source visibility, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final list-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- A unique top-level definition containing representable paragraphs and a standard bullet or ordered list with one plain paragraph per item mounts as one semantic editable Rich definition.
- Editing one list-item paragraph changes only its bounded definition child reconstruction; unchanged definition blocks, references, surrounding Markdown, unknown syntax, and unrelated definitions remain byte-identical.
- Bullet marker semantics, ordered-list start value, definition prefix spelling/spacing, footnote container indentation, block separation, and LF/CRLF convention remain valid and deterministic after serialization.
- One undo reverts the complete list-item edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing single-line, continuation-line, multi-paragraph, insertion, selection/replacement, identifier rename, semantic-reference, and read-rendering tests remain green.
- Nested-list, task-list, multi-paragraph-item, blockquote, code, table, callout, raw-HTML, nested-container, duplicate, malformed, unsafe, stale, or unmappable definitions remain source-only and never receive partial edits.
- Schema and serializer changes stay package-owned, host-independent, intentionally documented, and covered by API/architecture/security tests.
- Browser verification captures supported Rich before/after, exact resulting Source, at least one unsupported complex-list fallback, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real list-bearing footnote fixture and focused tests that fail because its supported definition is still source-only.
- RED: prove bullet and ordered-list editing, exact sibling-block preservation, container indentation, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove nested lists, task lists, multi-paragraph items, non-list nested blocks, nested containers, duplicates, malformed, unsafe, stale, and unmappable forms refuse safely.
- RED: prove simple, continuation, multi-paragraph, insertion, selection/replacement, and rename behaviors remain compatible.
- RED: add browser/runtime assertions for list editing, Source output, unsupported fallback visibility, save truth, and constrained containment.
- GREEN: generalize exact footnote child-layout reconstruction only enough for safe paragraph/list blocks, using existing ProseMirror list schema and Markdown serializers.
- REFACTOR: remove duplicated paragraph-only layout logic without broadening eligibility to arbitrary blocks or exposing exact-source metadata through rendered DOM.

### Manual verification

- Start the reference demo with one supported paragraph-plus-list definition and separate nested-list/task-list or non-list unsupported definitions.
- Edit the second supported list item in Rich mode, undo once, redo once, save, then switch to Source and inspect exact GFM indentation plus clean state.
- Confirm unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0061/`.

### Visual impact

Supported list-bearing definitions become semantic editable Rich blocks with normal list controls inside the definition body. Unsupported complex/nested list forms remain explicit preserved-source fallbacks. Final list indentation, marker density, definition spacing, fallback wording, focus flow, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/018-nested-lists-todos`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/023-multiline-footnote-editing`, `fixtures/024-multiparagraph-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-list-editing.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-footnote-multiline.test.mjs`, `tests/rich-footnote-multiparagraph.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056 through MME-0060 build-log/visual artifacts.

Reuse parser block children, existing bullet/ordered ProseMirror nodes, semantic footnote references/definitions, exact source ranges, child fingerprints, targeted source materialization, and conservative eligibility checks. Keep list/footnote view behavior inside `@momentarise/md-rich-prosemirror`; parser/source concerns stay in `@momentarise/md-format`. No core/model/save/policy package may depend on ProseMirror.

### Out of scope

- Nested list editing, task-list editing, loose/multi-paragraph list items, blockquotes, code blocks, tables, callouts, raw HTML, or arbitrary block editing inside footnotes.
- Container-nested definitions, definition reorder, automatic missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, or docs-content construction.
- Changing list marker style beyond deterministic Markdown-safe reconstruction of the intentionally edited list block.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible list-footnote UX/product review is queued for the end-of-run human review block unless preservation semantics remain unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0060 established semantic child blocks, exact per-child source layout, bounded definition reconstruction, history/save truth, and browser proof required by this slice.

## MME-0062 — Rich nested-list GFM footnote definition editing baseline

Accepted for code continuation 2026-07-21 after adding recursively safe semantic bullet/ordered list children inside unique top-level definitions, separating footnote container indentation from internal list indentation, exact unchanged-child source retention, bounded deterministic reconstruction of one changed top-level list child, ordered-start/hierarchy/LF/CRLF preservation, conservative task/loose/multi-child/unsafe/duplicate/stale/unmappable refusal, compatible selection/replacement/insertion/rename behavior, truthful history/save state, package docs, real browser proof, fallback review, and full test pass. Requested `gpt-5.3-codex-spark` xhigh reviewers hit the usage limit and no substitute model was used; documented fallback review found no remaining P0-P3 issue. Final hierarchy readability, marker density, definition spacing, fallback wording, full-editor focus outline, technical-diagnostics placement, Source visibility, and constrained-layout taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0062 until the next backlog item is promoted.

### Goal

Let users edit text inside safely representable nested bullet and ordered lists within unique top-level GFM footnote definitions while preserving Markdown hierarchy, container indentation, unrelated definition blocks, source-only fallbacks, history, and save truth.

### Scope

- Extend semantic rich list-bearing footnote definitions to represent standard bullet or ordered lists nested recursively inside list items.
- Limit each editable list item to exactly one representable paragraph followed by at most one recursively safe bullet or ordered list; keep task state and other child-block shapes excluded.
- Preserve bullet-versus-ordered semantics plus ordered-list start values at every nested level through package-owned ProseMirror list nodes.
- Preserve the definition identifier, first-line prefix, block separators, footnote container indentation, line endings, unchanged sibling definition-block bytes, and unrelated document bytes.
- Reconstruct only the containing top-level list child when nested item text changes; keep the complete Markdown document and every unchanged definition child source-preserved.
- Keep simple, continuation-line, multi-paragraph, flat-list, insertion, whole-body replacement, definition selection, semantic references, and identifier rename behavior compatible.
- Keep task lists, loose or multi-paragraph items, multiple non-paragraph children, blockquotes, code blocks, tables, callouts, raw HTML, and arbitrary nested structures source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, stale source, inconsistent indentation, and unmappable ranges in explicit source-only fallback.
- Treat one nested-item text edit as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for supported nested-list editing, undo/redo, Source visibility, save truth, unsupported task/loose fallback visibility, and constrained-width containment.
- Queue final nested-list-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- A unique top-level definition containing representable paragraphs and recursively nested standard bullet/ordered lists mounts as one semantic editable Rich definition.
- Every supported list item has one paragraph plus zero or one safe nested-list child; tasks, loose items, multiple nested child blocks, and arbitrary block content remain source-only.
- Editing one deepest nested-item paragraph changes only the bounded containing list-child reconstruction; unchanged definition blocks, references, surrounding Markdown, unknown syntax, and unrelated definitions remain byte-identical.
- Bullet/ordered hierarchy, ordered start values at each level, definition prefix spelling/spacing, footnote container indentation, block separation, and LF/CRLF convention remain valid and deterministic after serialization.
- One undo reverts the complete nested-item edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing single-line, continuation-line, multi-paragraph, flat-list, insertion, selection/replacement, identifier rename, semantic-reference, and read-rendering tests remain green.
- Task-list, loose/multi-paragraph-item, non-list nested-block, nested-container, duplicate, malformed, unsafe, stale, inconsistent-indent, or unmappable definitions remain source-only and never receive partial edits.
- Schema and serializer changes stay package-owned, host-independent, intentionally documented, and covered by API/architecture/security tests.
- Browser verification captures supported nested-list Rich before/after, exact resulting Source, at least one unsupported task/loose fallback, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real nested-list footnote fixture and focused tests that fail because its supported definition is still source-only.
- RED: prove nested bullet/ordered text editing, ordered starts at multiple levels, exact sibling-block preservation, container indentation, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove task lists, loose/multi-paragraph items, multiple nested child blocks, non-list nested blocks, nested containers, duplicates, malformed, unsafe, stale, inconsistent-indent, and unmappable forms refuse safely.
- RED: prove simple, continuation, multi-paragraph, flat-list, insertion, selection/replacement, and rename behaviors remain compatible.
- RED: add browser/runtime assertions for nested-list editing, Source output, unsupported fallback visibility, save truth, and constrained containment.
- GREEN: generalize the closed footnote list-item eligibility check only enough for one paragraph plus one recursively safe standard nested list, reusing existing ProseMirror list nodes and Markdown serializers.
- REFACTOR: isolate recursive list eligibility from paragraph/list conversion without broadening support to task or arbitrary block children and without exposing exact-source metadata through rendered DOM.

### Manual verification

- Start the reference demo with one supported paragraph-plus-nested-list definition and separate task-list/loose-item unsupported definitions.
- Edit one deepest nested list item in Rich mode, undo once, redo once, save, then switch to Source and inspect exact GFM hierarchy plus clean state.
- Confirm unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0062/`.

### Visual impact

Supported nested-list definitions become semantic editable Rich blocks with visible nested bullet/ordered hierarchy inside the definition body. Unsupported task/loose/complex forms remain explicit preserved-source fallbacks. Final nested indentation, marker density, hierarchy readability, definition spacing, fallback wording, focus flow, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/018-nested-lists-todos`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/023-multiline-footnote-editing`, `fixtures/024-multiparagraph-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-list-editing.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-footnote-multiline.test.mjs`, `tests/rich-footnote-multiparagraph.test.mjs`, `tests/rich-footnote-list-blocks.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056 through MME-0061 build-log/visual artifacts.

Reuse parser list/list-item children, existing recursive bullet/ordered ProseMirror nodes, semantic footnote references/definitions, exact top-level definition-child source ranges, child fingerprints, targeted source materialization, and conservative eligibility checks. Keep list/footnote view behavior inside `@momentarise/md-rich-prosemirror`; parser/source concerns stay in `@momentarise/md-format`. No core/model/save/policy package may depend on ProseMirror.

### Out of scope

- Task-list editing, loose/multi-paragraph list items, multiple nested list children per item, blockquotes, code blocks, tables, callouts, raw HTML, or arbitrary block editing inside footnotes.
- Structural Tab/Shift+Tab indentation, list-item insertion/deletion/reordering, or marker-style preservation for intentionally changed containing lists.
- Container-nested definitions, definition reorder, automatic missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible nested-list-footnote UX/product review is queued for the end-of-run human review block unless preservation semantics remain unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0061 established semantic flat-list children, exact per-child source layout, bounded list-child reconstruction, history/save truth, and browser proof required by this slice.

## MME-0063 — Rich task-list GFM footnote definition editing baseline

Accepted for code continuation 2026-07-21 after adding semantic checked/unchecked task items to safe flat and recursively nested footnote lists, closed recursive eligibility, task-child indentation that reparses as the same hierarchy, exact untouched source retention, bounded changed-list reconstruction, ordered-start/prefix/container-indent/LF/CRLF preservation, native accessible pointer/keyboard toggles, one-step history, truthful save state, compatible selection/replacement/insertion/rename behavior, package docs, real browser proof, fallback review, and full test pass. Requested `gpt-5.3-codex-spark` xhigh reviewers both hit the usage limit until 2026-07-26 and no substitute model was used; documented fallback review found no remaining P0-P3 issue. Final task density, hierarchy readability, toggle styling, fallback wording, full-editor focus outline, technical-diagnostics placement, Source visibility, and constrained-layout taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0063 until the next backlog item is promoted.

### Goal

Let users edit text and checked state inside safely representable flat or recursively nested GFM task lists within unique top-level footnote definitions while preserving Markdown hierarchy, unrelated source, source-only fallbacks, history, and save truth.

### Scope

- Extend semantic list-bearing footnote definitions to accept GFM task items alongside standard list items when every item remains recursively safe.
- Limit each editable standard or task item to exactly one representable paragraph followed by at most one recursively safe bullet or ordered list.
- Preserve checked and unchecked task semantics through package-owned ProseMirror `todo_item` nodes and the existing accessible task-toggle behavior.
- Support task items in otherwise safe flat, nested, and mixed standard/task list hierarchies without adding arbitrary block editing.
- Preserve the definition identifier, first-line prefix, block separators, footnote container indentation, line endings, unchanged sibling definition-child bytes, and unrelated document bytes.
- Reconstruct only the containing top-level list child when task text or checked state changes; keep every unchanged definition child source-preserved.
- Keep simple, continuation-line, multi-paragraph, standard-list, nested-standard-list, insertion, whole-body replacement, definition selection, semantic references, and identifier rename behavior compatible.
- Keep loose or multi-paragraph items, multiple nested child blocks, blockquotes, code blocks, tables, callouts, raw HTML, and arbitrary nested structures source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, stale source, inconsistent indentation, and unmappable ranges in explicit source-only fallback.
- Treat one task text edit or checked-state toggle as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for task text editing, pointer/keyboard-accessible state toggling, undo/redo, Source visibility, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final task-list-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- A unique top-level definition containing representable paragraphs plus safe flat or recursively nested GFM task items mounts as one semantic editable Rich definition.
- Supported task items retain semantic checked state, accessible toggle labels/pressed state, safe paragraph text, and zero or one recursively safe nested-list child.
- Editing one deepest task paragraph or toggling one task changes only the bounded containing list-child reconstruction; unchanged definition blocks, references, surrounding Markdown, unknown syntax, and unrelated definitions remain byte-identical.
- Standard/task hierarchy, checked state, representable ordered starts, definition prefix spelling/spacing, footnote container indentation, block separation, and LF/CRLF convention remain valid and deterministic after serialization.
- One undo reverts one task text edit or one state toggle; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing single-line, continuation-line, multi-paragraph, flat-list, nested-list, insertion, selection/replacement, identifier rename, semantic-reference, and read-rendering tests remain green.
- Loose/multi-paragraph items, multiple nested child blocks, non-list nested blocks, nested-container, duplicate, malformed, unsafe, stale, inconsistent-indent, or unmappable definitions remain source-only and never receive partial edits.
- Schema, serializer, task-toggle behavior, and source mapping stay package-owned, host-independent, intentionally documented, and covered by API/architecture/security tests.
- Browser verification captures supported task-list Rich before/after text and state changes, exact resulting Source, at least one unsupported loose/arbitrary fallback, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real task-list footnote fixture and focused tests that fail because its safe task definitions are still source-only.
- RED: prove flat and recursively nested checked/unchecked task semantics, deep text editing, state toggling, exact sibling-child preservation, container indentation, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove loose/multi-paragraph items, multiple nested child blocks, non-list nested blocks, nested containers, duplicates, malformed, unsafe, stale, inconsistent-indent, and unmappable forms refuse safely.
- RED: prove simple, continuation, multi-paragraph, standard-list, nested-standard-list, insertion, selection/replacement, and rename behaviors remain compatible.
- RED: add browser/runtime assertions for task text/state editing, Source output, unsupported fallback visibility, save truth, accessibility state, and constrained containment.
- GREEN: generalize the recursive footnote list eligibility check only enough for safe task items, reusing existing `todo_item` nodes, task-toggle commands, list serializers, and bounded child reconstruction.
- REFACTOR: isolate standard/task item eligibility without broadening support to loose or arbitrary block children and without exposing exact-source metadata through rendered DOM.

### Manual verification

- Start the reference demo with one supported checked/unchecked nested-task definition and separate loose/arbitrary unsupported definitions.
- Edit one deepest task item in Rich mode, toggle one checked state by pointer and keyboard-accessible control, undo/redo each action, save, then switch to Source and inspect exact GFM task Markdown plus clean state.
- Confirm unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0063/`.

### Visual impact

Supported task-list definitions become semantic editable Rich blocks with accessible checked/unchecked controls at each supported depth. Unsupported loose and arbitrary forms remain explicit preserved-source fallbacks. Final nested task density, control styling, hierarchy readability, focus flow, fallback wording, definition spacing, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/018-nested-lists-todos`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/023-multiline-footnote-editing`, `fixtures/024-multiparagraph-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-list-editing.test.mjs`, `tests/rich-core-interactions.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-footnote-multiline.test.mjs`, `tests/rich-footnote-multiparagraph.test.mjs`, `tests/rich-footnote-list-blocks.test.mjs`, `tests/rich-footnote-nested-lists.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056 through MME-0062 build-log/visual artifacts.

Reuse parser task-item attributes, recursive bullet/ordered ProseMirror nodes, existing `todo_item` DOM/keyboard behavior, semantic footnote references/definitions, exact top-level definition-child source ranges, child fingerprints, targeted source materialization, and conservative eligibility checks. Keep list/footnote view behavior inside `@momentarise/md-rich-prosemirror`; parser/source concerns stay in `@momentarise/md-format`. No core/model/save/policy package may depend on ProseMirror.

### Out of scope

- Loose/multi-paragraph task items, multiple nested list children per item, blockquotes, code blocks, tables, callouts, raw HTML, or arbitrary block editing inside footnotes.
- New task-list insertion commands, structural Tab/Shift+Tab indentation, list-item insertion/deletion/reordering, or original marker/case preservation for intentionally changed containing lists.
- Container-nested definitions, definition reorder, automatic missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible task-list-footnote UX/product review is queued for the end-of-run human review block unless preservation or task-state semantics remain unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0062 established recursively safe standard-list children, separated container/internal indentation, bounded list-child reconstruction, history/save truth, and browser proof required by this slice.

## MME-0064 — Rich loose-list-item GFM footnote definition editing baseline

### Goal

Let users edit safely representable loose/list-spread and multi-paragraph standard or task list items inside unique top-level GFM footnote definitions while preserving blank-line semantics, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

### Scope

- Extend safe semantic footnote lists to accept list-level spread and list items containing multiple representable paragraphs.
- Require every editable item to begin with one representable paragraph; allow additional representable paragraphs plus at most one recursively safe bullet or ordered list in the remaining child sequence.
- Support standard and task items in bullet or ordered lists, including safe recursive mixed standard/task descendants, without admitting arbitrary block children.
- Preserve whether changed list reconstruction requires loose blank-line separation between items and between one item's child blocks through package-owned semantic ProseMirror attributes derived from source layout.
- Preserve checked state, representable ordered starts, definition identifier, first-line prefix, outer footnote indentation, line endings, unchanged sibling definition-child bytes, references, unknown syntax, and unrelated document bytes.
- Reconstruct only the containing top-level list child when one loose-item paragraph, nested safe item, or task checked state changes; require the reconstructed Markdown to reparse to the same semantic paragraph/list/task hierarchy.
- Keep simple, continuation-line, top-level multi-paragraph, tight standard/task list, nested standard/task list, insertion, whole-body replacement, definition selection, semantic references, and identifier rename behavior compatible.
- Keep items with multiple nested list children, blockquotes, code blocks, tables, callouts, raw HTML, or other arbitrary child blocks source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, stale source, invalid or inconsistent indentation, and unmappable ranges in explicit whole-definition source-only fallback.
- Treat one paragraph edit, nested-item edit, or task-state toggle as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for multi-paragraph item editing, task toggling, undo/redo, exact Source output, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final loose-list-item footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Unique top-level definitions containing safe loose bullet/ordered lists, multi-paragraph standard/task items, and at most one recursively safe list child per item mount as semantic editable Rich definitions.
- Untouched supported definitions serialize byte-for-byte; list/item loose semantics remain package-owned state and exact child-source metadata remains absent from rendered DOM attributes.
- Editing one second-or-later item paragraph, one safe nested item, or one task state reconstructs only the bounded containing list child; every unchanged definition child and unrelated source range remains byte-identical.
- Reconstructed loose Markdown retains required blank-line boundaries, standard/task hierarchy, checked state, ordered starts, definition prefix spelling/spacing, outer indentation, and LF/CRLF convention, and reparses to the same semantic shape.
- One undo reverts one paragraph edit or task toggle; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing single-line, continuation-line, top-level multi-paragraph, tight list, nested list, task list, insertion, selection/replacement, identifier rename, semantic-reference, and read-rendering tests remain green.
- Multiple nested lists, blockquotes, code blocks, tables, callouts, raw HTML, arbitrary children, nested-container, duplicate, malformed, unsafe, stale, invalid-indent, or unmappable definitions remain source-only and never receive partial edits.
- Schema, layout classification, serializer, task-toggle behavior, and source mapping stay inside `@momentarise/md-rich-prosemirror`, remain host-independent, and pass API/architecture/security gates.
- Browser verification captures supported loose-list Rich before/after paragraph and task-state changes, exact resulting Source, at least one arbitrary-child fallback, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real loose-list footnote fixture and focused test that fails because safe loose/list-spread and multi-paragraph definitions remain source-only.
- RED: prove loose bullet/ordered/task semantics, multiple safe paragraphs, one safe nested-list child, deep paragraph editing, task toggling, exact sibling-child preservation, ordered starts, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove changed output reparses to the same paragraph/list/task hierarchy with valid blank-line separation.
- RED: prove multiple nested lists, quotes, code, tables, callouts, raw HTML, arbitrary blocks, nested containers, duplicates, malformed, unsafe, stale, invalid-indent, and unmappable forms refuse atomically.
- RED: prove prior footnote definition, insertion, rename, tight-list, nested-list, and task-list behavior remains compatible.
- RED: add browser/runtime assertions for loose paragraph editing, task state, Source output, fallback visibility, save truth, accessibility state, and constrained containment.
- GREEN: generalize only safe item-child eligibility and semantic loose-layout reconstruction, reusing existing parser source ranges, list/task nodes, task controls, child fingerprints, and bounded footnote serialization.
- REFACTOR: isolate source-derived loose list/item classification and deterministic child separation without exposing source bytes through DOM or broadening arbitrary block support.

### Manual verification

- Start the reference demo with supported loose standard/task definitions and separate multiple-list/arbitrary-block unsupported definitions.
- Edit a second item paragraph in Rich mode, toggle one loose task by pointer and keyboard-accessible control, undo/redo each action, save, then switch to Source and inspect exact valid loose GFM Markdown plus clean state.
- Confirm unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0064/`.

### Visual impact

Supported loose list items become semantic Rich content with visibly separated paragraphs and nested list/task structure inside footnote definitions. Unsupported multiple-list and arbitrary-block forms remain explicit preserved-source fallbacks. Final paragraph spacing, loose-list density, nested hierarchy, task control alignment, focus flow, fallback wording, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/018-nested-lists-todos`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/023-multiline-footnote-editing`, `fixtures/024-multiparagraph-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `fixtures/027-task-list-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-list-editing.test.mjs`, `tests/rich-core-interactions.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-footnote-multiline.test.mjs`, `tests/rich-footnote-multiparagraph.test.mjs`, `tests/rich-footnote-list-blocks.test.mjs`, `tests/rich-footnote-nested-lists.test.mjs`, `tests/rich-footnote-task-lists.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056 through MME-0063 build-log/visual artifacts.

Reuse parser-owned item child order/source ranges, existing paragraph/list/task ProseMirror nodes, semantic footnote references/definitions, exact top-level definition-child source layout, child fingerprints, targeted source materialization, task controls, and conservative eligibility checks. Keep loose-layout state and reconstruction inside `@momentarise/md-rich-prosemirror`; do not add ProseMirror concepts to core/model/save/policy packages. Prefer source-derived semantic spacing over a parser public-contract expansion unless tests prove the latter necessary.

### Out of scope

- Multiple nested list children per item, blockquotes, code blocks, tables, callouts, raw HTML, arbitrary block editing, or generic Markdown block reordering inside footnotes.
- New list/task insertion commands, structural Tab/Shift+Tab indentation redesign, list-item insertion/deletion/reordering, or original marker/case preservation for intentionally changed containing lists.
- Container-nested definitions, definition reorder, missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, task DOM redesign, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible loose-list-footnote UX/product review is queued for the end-of-run human review block unless blank-line or hierarchy preservation remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0063 established safe mixed task/standard hierarchy, structural-marker indentation, bounded list-child reconstruction, accessible task toggles, history/save truth, and browser proof required by this slice.

## MME-0065 — Rich blockquote GFM footnote definition editing baseline

### Goal

Let users edit safely representable paragraph-only blockquotes inside unique top-level GFM footnote definitions, including one quote child inside a safe standard or task list item, while preserving quote/blank-line semantics, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

### Scope

- Extend safe semantic footnote definition children to accept blockquotes containing one or more representable paragraphs.
- Allow one safe paragraph-only blockquote as the single container child after the required first paragraph in a standard or task list item; additional safe paragraphs remain allowed around it.
- Support top-level definition blockquotes plus blockquotes nested one level inside safe bullet/ordered standard/task items without admitting nested quotes or arbitrary block children.
- Reject Obsidian-style callout markers atomically so `> [!TYPE]` remains source-only until a dedicated callout contract exists.
- Preserve paragraph boundaries through deterministic `>` blank quote lines when a changed blockquote is reconstructed.
- Preserve list/item loose state, checked state, representable ordered starts, definition identifier, first-line prefix, outer footnote indentation, line endings, unchanged sibling definition-child bytes, references, unknown syntax, and unrelated document bytes.
- Reconstruct only the containing top-level definition child or list child when quoted text changes; require reconstructed Markdown to reparse to the same paragraph/blockquote/list/task hierarchy.
- Keep simple, continuation-line, top-level multi-paragraph, tight/loose standard/task list, nested list, insertion, whole-body replacement, definition selection, semantic references, and identifier rename behavior compatible.
- Keep nested blockquotes, callouts, blockquotes containing lists/code/tables/raw HTML, list items combining a quote with another container child, and other arbitrary block children source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, stale source, invalid/inconsistent indentation, and unmappable ranges in explicit whole-definition source-only fallback.
- Treat one quoted-paragraph edit as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for top-level and list-nested blockquote editing, undo/redo, exact Source output, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final blockquote-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Unique top-level definitions containing safe paragraph-only blockquotes, including one quote child inside safe standard/task list items, mount as semantic editable Rich definitions.
- Untouched supported definitions serialize byte-for-byte; quote/list spacing state remains package-owned and exact child-source metadata remains absent from rendered DOM attributes.
- Editing one quoted paragraph reconstructs only its bounded containing definition child or list child; unchanged definition children and unrelated source ranges remain byte-identical.
- Reconstructed Markdown retains required `>` paragraph separators, list looseness, standard/task hierarchy, checked state, ordered starts, definition prefix spelling/spacing, outer indentation, and LF/CRLF convention, and reparses to the same semantic shape.
- One undo reverts one quote edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing single-line, continuation-line, multi-paragraph, tight/loose list, nested list, task list, insertion, selection/replacement, identifier rename, semantic-reference, and read-rendering tests remain green.
- Nested quotes, callouts, quote children containing lists/code/tables/raw HTML, mixed multiple-container list items, nested-container, duplicate, malformed, unsafe, stale, invalid-indent, or unmappable definitions remain source-only and never receive partial edits.
- Schema, layout classification, serializer, and source mapping stay inside `@momentarise/md-rich-prosemirror`, remain host-independent, and pass API/architecture/security gates.
- Browser verification captures supported Rich quotes before/after text changes, exact resulting Source, at least one callout/arbitrary-child fallback, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real blockquote-footnote fixture and focused test that fails because safe paragraph-only quote definitions remain source-only.
- RED: prove top-level and list/task-nested quote semantics, multiple quoted paragraphs, deep quote editing, exact sibling-child preservation, ordered starts, loose spacing, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove changed output reparses to the same paragraph/blockquote/list/task hierarchy with valid `>` blank-line separation.
- RED: prove nested quotes, callouts, quote-contained lists/code/tables/raw HTML, mixed quote-plus-list items, nested containers, duplicates, malformed, unsafe, stale, invalid-indent, and unmappable forms refuse atomically.
- RED: prove prior footnote definition, insertion, rename, multiline, multi-paragraph, list, nested-list, task-list, and loose-list behavior remains compatible.
- RED: add browser/runtime assertions for quote editing, Source output, fallback visibility, save truth, accessibility role, and constrained containment.
- GREEN: generalize only safe quote eligibility/conversion plus deterministic paragraph separation, reusing existing blockquote nodes, parser source ranges, child fingerprints, loose-list state, and bounded footnote serialization.
- REFACTOR: isolate paragraph-only quote validation and quote serialization without exposing source bytes through DOM or broadening arbitrary block support.

### Manual verification

- Start the reference demo with supported top-level/list/task paragraph-only quotes and separate callout/nested/arbitrary-child unsupported definitions.
- Edit a later quoted paragraph in Rich mode, undo/redo, save, then switch to Source and inspect exact valid blockquote Markdown plus clean state.
- Confirm unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0065/`.

### Visual impact

Supported paragraph-only blockquotes become semantic Rich content inside footnote definitions and safe list/task items. Unsupported callouts, nested quotes, and arbitrary quote children remain explicit preserved-source fallbacks. Final quote spacing, marker density, nested hierarchy, focus flow, fallback wording, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/006-blockquote`, `fixtures/007-obsidian-callout`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/023-multiline-footnote-editing`, `fixtures/024-multiparagraph-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `fixtures/027-task-list-footnote-editing`, `fixtures/028-loose-list-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-commands.test.mjs`, `tests/rich-input-rules.test.mjs`, `tests/rich-core-interactions.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-footnote-multiline.test.mjs`, `tests/rich-footnote-multiparagraph.test.mjs`, `tests/rich-footnote-list-blocks.test.mjs`, `tests/rich-footnote-nested-lists.test.mjs`, `tests/rich-footnote-task-lists.test.mjs`, `tests/rich-footnote-loose-lists.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056 through MME-0064 build-log/visual artifacts.

Reuse the existing blockquote ProseMirror node, parser-owned child order/source ranges, semantic footnote references/definitions, exact top-level definition-child source layout, child fingerprints, source-derived loose state, targeted source materialization, and conservative eligibility checks. Keep quote eligibility and reconstruction inside `@momentarise/md-rich-prosemirror`; do not add ProseMirror concepts to core/model/save/policy packages. Reject callouts by source/model semantics rather than treating every blockquote as editable.

### Out of scope

- Nested blockquotes, callouts, quote-contained lists/code/tables/raw HTML, multiple container children per list item, or generic arbitrary-block editing inside footnotes.
- New quote insertion commands, structural list/quote insertion/deletion/reordering, Tab/Shift+Tab redesign, or original quote-marker spacing preservation for intentionally changed containing blocks.
- Container-nested definitions, definition reorder, missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, task DOM redesign, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible blockquote-footnote UX/product review is queued for the end-of-run human review block unless quote hierarchy preservation remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0064 established source-derived loose spacing, safe multi-paragraph/list/task hierarchy, bounded reconstruction, history/save truth, and browser proof required by this slice.

## MME-0066 — Rich fenced-code GFM footnote definition editing baseline

### Goal

Let users edit safely representable fenced code blocks inside unique top-level GFM footnote definitions, including one fenced-code child inside a safe standard or task list item, while preserving code text, language/meta, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

### Scope

- Extend safe semantic footnote definition children to accept fenced code blocks with text content plus optional parser-owned language and meta strings.
- Allow one safe fenced code block as the single container child after the required first paragraph in a standard or task list item; additional safe paragraphs remain allowed around it.
- Support top-level definition code fences plus fences nested one level inside recursively safe bullet/ordered standard/task items without admitting indented code or arbitrary block children.
- Preserve untouched opening/closing marker, fence length, info spacing, body bytes, definition identifier, first-line prefix, outer footnote indentation, line endings, unchanged sibling definition-child bytes, references, unknown syntax, and unrelated document bytes.
- Reconstruct only the containing top-level definition child or list child when code text changes; emit a deterministic backtick or tilde fence long enough not to collide with body fence runs and require reparsing to the same paragraph/code/list/task hierarchy.
- Preserve language/meta semantics during code-text edits and keep code content inert text in DOM/serialization; no execution or HTML interpretation.
- Keep simple, continuation-line, top-level multi-paragraph, tight/loose standard/task list, nested list, blockquote, insertion, whole-body replacement, definition selection, semantic references, and identifier rename behavior compatible.
- Keep indented code blocks, quote-contained code, list items combining code with another container child, tables, callouts, raw HTML, and other arbitrary block children source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, stale source, invalid/inconsistent indentation, and unmappable ranges in explicit whole-definition source-only fallback.
- Treat one code-text edit as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for top-level and list/task-nested fenced-code editing, undo/redo, exact Source output, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final fenced-code-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Unique top-level definitions containing safe fenced code blocks, including one fence child inside safe standard/task list items, mount as semantic editable Rich definitions.
- Untouched supported definitions serialize byte-for-byte; fence/layout state remains package-owned and exact source/fingerprint metadata remains absent from rendered DOM attributes.
- Editing code text reconstructs only its bounded containing definition child or list child; unchanged definition children and unrelated source ranges remain byte-identical.
- Reconstructed Markdown uses a valid non-colliding fence, retains code text, language/meta, list looseness, standard/task hierarchy, checked state, ordered starts, definition prefix spelling/spacing, outer indentation, and LF/CRLF convention, and reparses to the same semantic shape.
- One undo reverts one code edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing single-line, continuation-line, multi-paragraph, tight/loose list, nested list, task list, blockquote, insertion, selection/replacement, identifier rename, semantic-reference, code-block, and read-rendering tests remain green.
- Indented code, quote-contained code, mixed multiple-container list items, table/callout/raw-HTML/arbitrary children, nested-container, duplicate, malformed, unsafe, stale, invalid-indent, or unmappable definitions remain source-only and never receive partial edits.
- Schema, fence selection, serializer, and source mapping stay inside `@momentarise/md-rich-prosemirror`, remain host-independent, and pass API/architecture/security gates.
- Browser verification captures supported Rich fences before/after code changes, exact resulting Source, at least one indented-code or mixed-container fallback, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real fenced-code-footnote fixture and focused test that fails because safe fenced-code definitions remain source-only.
- RED: prove top-level and list/task-nested code semantics, multiline text editing, language/meta retention, deep edits, exact sibling-child preservation, ordered starts, loose spacing, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove changed output selects a non-colliding fence for body marker runs and reparses to the same paragraph/code/list/task hierarchy.
- RED: prove indented code, quote-contained code, mixed code-plus-list/quote items, tables, callouts, raw HTML, nested containers, duplicates, malformed, unsafe, stale, invalid-indent, and unmappable forms refuse atomically.
- RED: prove prior footnote definition, insertion, rename, multiline, multi-paragraph, list, nested-list, task-list, loose-list, and blockquote behavior remains compatible.
- RED: add browser/runtime assertions for code editing, Source output, fallback visibility, save truth, inert code content, and constrained containment.
- GREEN: generalize only safe fenced-code eligibility/conversion plus collision-proof fence serialization, reusing existing code-block nodes, parser source ranges, child fingerprints, loose-list state, and bounded footnote serialization.
- REFACTOR: isolate fenced-code validation and deterministic fence selection without exposing source bytes through DOM or broadening arbitrary block support.

### Manual verification

- Start the reference demo with supported top-level/list/task fenced code blocks and separate indented-code/mixed-container unsupported definitions.
- Edit multiline code in Rich mode, undo/redo, save, then switch to Source and inspect exact valid fenced Markdown plus clean state.
- Confirm unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0066/`.

### Visual impact

Supported fenced code blocks become semantic Rich content inside footnote definitions and safe list/task items. Unsupported indented code, quote-contained code, mixed containers, and arbitrary children remain explicit preserved-source fallbacks. Final code density, language/meta visibility, nested hierarchy, focus flow, fallback wording, horizontal overflow, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/005-code-fence-language`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/023-multiline-footnote-editing`, `fixtures/024-multiparagraph-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `fixtures/027-task-list-footnote-editing`, `fixtures/028-loose-list-footnote-editing`, `fixtures/029-blockquote-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-prosemirror-package.test.mjs`, `tests/rich-commands.test.mjs`, `tests/rich-input-rules.test.mjs`, `tests/rich-core-interactions.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-footnote-multiline.test.mjs`, `tests/rich-footnote-multiparagraph.test.mjs`, `tests/rich-footnote-list-blocks.test.mjs`, `tests/rich-footnote-nested-lists.test.mjs`, `tests/rich-footnote-task-lists.test.mjs`, `tests/rich-footnote-loose-lists.test.mjs`, `tests/rich-footnote-blockquotes.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056 through MME-0065 build-log/visual artifacts.

Reuse the existing code-block ProseMirror node, parser-owned code-fence value/language/meta plus source ranges, semantic footnote references/definitions, exact top-level definition-child source layout, child fingerprints, source-derived loose state, targeted source materialization, and conservative eligibility checks. Keep fence eligibility and reconstruction inside `@momentarise/md-rich-prosemirror`; do not add ProseMirror concepts to core/model/save/policy packages. Preserve untouched fence bytes exactly and make intentionally changed fence output collision-proof rather than assuming triple backticks are always safe.

### Out of scope

- Indented code blocks, quote-contained code, tables, callouts, raw HTML, multiple container children per list item, or generic arbitrary-block editing inside footnotes.
- New code-fence insertion commands, language/meta control redesign, code execution, syntax-highlighter integration, structural list/code insertion/deletion/reordering, Tab/Shift+Tab redesign, or original fence-marker/style preservation for intentionally changed containing blocks.
- Container-nested definitions, definition reorder, missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, task DOM redesign, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible fenced-code-footnote UX/product review is queued for the end-of-run human review block unless fence/hierarchy preservation remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0065 established source-aware arbitrary-block refusal, safe list/task/quote hierarchy, bounded reconstruction, history/save truth, and browser proof required by this slice; existing rich code-block nodes already provide inert editable code content plus language/meta attributes.

## MME-0067 — Rich indented-code GFM footnote definition editing baseline

### Goal

Let users edit safely representable indented code blocks inside unique top-level GFM footnote definitions, including one indented-code child inside a safe standard or task list item, while preserving code text, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

### Scope

- Extend safe semantic footnote definition children to accept parser-recognized indented code blocks with plain text content and no language/meta info string.
- Distinguish indented code from fenced code through source-aware package-owned validation while retaining the shared parser `codeFence` model type and ProseMirror `code_block` node.
- Allow one safe indented code block as the single container child after the required first paragraph in a standard or task list item; additional safe paragraphs remain allowed around it.
- Support top-level definition indented code plus indented code nested one level inside recursively safe bullet/ordered standard/task items without admitting arbitrary block children.
- Preserve untouched indentation bytes, blank code lines, internal code whitespace, definition identifier, first-line prefix, outer footnote indentation, line endings, unchanged sibling definition-child bytes, references, unknown syntax, and unrelated document bytes.
- Reconstruct only the containing top-level definition child or list child when code text changes; emit deterministic four-space indented Markdown at the code-block layer and require reparsing to the same paragraph/code/list/task hierarchy.
- Keep code content inert text in DOM/serialization and expose no exact source/fingerprint metadata through rendered DOM attributes.
- Keep fenced-code, simple, continuation-line, top-level multi-paragraph, tight/loose standard/task list, nested list, blockquote, insertion, whole-body replacement, definition selection, semantic references, and identifier rename behavior compatible.
- Keep inconsistent or unmappable indented-code layouts, quote-contained code, list items combining code with another container child, tables, callouts, raw HTML, and other arbitrary block children source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, stale source, invalid/inconsistent outer indentation, and unmappable ranges in explicit whole-definition source-only fallback.
- Treat one code-text edit as one ProseMirror history action and keep Save Engine/autosave hashes truthful.
- Add runtime browser proof for top-level and list/task-nested indented-code editing, undo/redo, exact Source output, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final indented-code-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Unique top-level definitions containing safe indented code blocks, including one indented-code child inside safe standard/task list items, mount as semantic editable Rich definitions.
- Untouched supported definitions serialize byte-for-byte; source syntax/layout state remains package-owned and exact source/fingerprint metadata remains absent from rendered DOM attributes.
- Editing code text reconstructs only its bounded containing definition child or list child; unchanged definition children and unrelated source ranges remain byte-identical.
- Reconstructed Markdown remains indented code, retains exact code text, blank lines, standard/task hierarchy, checked state, ordered starts, list looseness, definition prefix spelling/spacing, outer indentation, and LF/CRLF convention, and reparses to the same semantic shape.
- One undo reverts one code edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing single-line, continuation-line, multi-paragraph, tight/loose list, nested list, task list, blockquote, fenced-code, insertion, selection/replacement, identifier rename, semantic-reference, code-block, and read-rendering tests remain green.
- Fenced code remains handled by MME-0066; quote-contained code, mixed multiple-container list items, table/callout/raw-HTML/arbitrary children, inconsistent or unmappable indented code, nested-container, duplicate, malformed, unsafe, stale, invalid-indent, or unmappable definitions remain source-only and never receive partial edits.
- Schema, source-syntax discrimination, serializer, and source mapping stay inside `@momentarise/md-rich-prosemirror`, remain host-independent, and pass API/architecture/security gates.
- Browser verification captures supported Rich indented code before/after changes, exact resulting Source, at least one inconsistent-layout or mixed-container fallback, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real indented-code-footnote fixture and focused test that fails because safe indented-code definitions remain source-only.
- RED: prove top-level and list/task-nested code semantics, multiline text editing, internal whitespace and blank-line retention, deep edits, exact sibling-child preservation, ordered starts, loose spacing, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove changed output remains deterministic indented code and reparses to the same paragraph/code/list/task hierarchy.
- RED: prove inconsistent indentation, quote-contained code, mixed code-plus-list/quote items, tables, callouts, raw HTML, nested containers, duplicates, malformed, unsafe, stale, invalid-indent, and unmappable forms refuse atomically.
- RED: prove prior footnote definition, insertion, rename, multiline, multi-paragraph, list, nested-list, task-list, loose-list, blockquote, and fenced-code behavior remains compatible.
- RED: add browser/runtime assertions for code editing, Source output, fallback visibility, save truth, inert code content, and constrained containment.
- GREEN: generalize only safe indented-code eligibility/conversion plus deterministic indented-code serialization, reusing existing code-block nodes, parser source ranges, child fingerprints, loose-list state, and bounded footnote serialization.
- REFACTOR: isolate fenced-versus-indented source validation and deterministic code-style serialization without exposing source bytes through DOM or broadening arbitrary block support.

### Manual verification

- Start the reference demo with supported top-level/list/task indented code blocks and separate inconsistent-layout/mixed-container unsupported definitions.
- Edit multiline code in Rich mode, undo/redo, save, then switch to Source and inspect exact valid indented Markdown plus clean state.
- Confirm unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0067/`.

### Visual impact

Supported indented code blocks become semantic Rich code content inside footnote definitions and safe list/task items. Unsupported inconsistent indentation, quote-contained code, mixed containers, and arbitrary children remain explicit preserved-source fallbacks. Final code density, hierarchy, focus flow, fallback wording, horizontal overflow, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/005-code-fence-language`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/023-multiline-footnote-editing`, `fixtures/024-multiparagraph-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `fixtures/027-task-list-footnote-editing`, `fixtures/028-loose-list-footnote-editing`, `fixtures/029-blockquote-footnote-editing`, `fixtures/030-fenced-code-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-prosemirror-package.test.mjs`, `tests/rich-commands.test.mjs`, `tests/rich-input-rules.test.mjs`, `tests/rich-core-interactions.test.mjs`, `tests/rich-footnote-editing.test.mjs`, `tests/rich-footnote-insertion.test.mjs`, `tests/rich-footnote-rename.test.mjs`, `tests/rich-footnote-multiline.test.mjs`, `tests/rich-footnote-multiparagraph.test.mjs`, `tests/rich-footnote-list-blocks.test.mjs`, `tests/rich-footnote-nested-lists.test.mjs`, `tests/rich-footnote-task-lists.test.mjs`, `tests/rich-footnote-loose-lists.test.mjs`, `tests/rich-footnote-blockquotes.test.mjs`, `tests/rich-footnote-fenced-code.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, and the MME-0056 through MME-0066 build-log/visual artifacts.

Reuse the existing code-block ProseMirror node, parser-owned code value plus source ranges, semantic footnote references/definitions, exact top-level definition-child source layout, child fingerprints, source-derived loose state, targeted source materialization, and conservative eligibility checks. Keep source-syntax detection and reconstruction inside `@momentarise/md-rich-prosemirror`; do not add ProseMirror concepts to core/model/save/policy packages. Preserve untouched indentation bytes exactly and normalize only intentionally changed indented code to a valid deterministic four-space code indent at its block layer.

### Out of scope

- Quote-contained code, tables, callouts, raw HTML, multiple container children per list item, inconsistent/unmappable indentation, or generic arbitrary-block editing inside footnotes.
- New code-block insertion commands, language/meta controls for indented code, code execution, syntax-highlighter integration, structural list/code insertion/deletion/reordering, Tab/Shift+Tab redesign, or original indentation-style preservation for intentionally changed containing blocks.
- Container-nested definitions, definition reorder, missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, task DOM redesign, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible indented-code-footnote UX/product review is queued for the end-of-run human review block unless indentation/hierarchy preservation remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0066 established source-aware fenced-code discrimination, inert rich code nodes, collision-safe serialization, safe list/task containment, bounded reconstruction, history/save truth, and browser proof; parser feasibility confirms indented code already arrives as a source-ranged plain-text code node without widening the public model contract.

## MME-0068 — Rich table GFM footnote definition editing baseline

### Goal

Let users edit safely representable GFM pipe tables inside unique top-level footnote definitions, including one table child inside a safe standard or task list item, while preserving table semantics, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

### Scope

- Extend safe semantic footnote definition children to accept rectangular parser-recognized GFM tables whose cells are already representable by the existing rich table model.
- Allow one safe table as the single container child after the required first paragraph in a standard or task list item; additional safe paragraphs remain allowed around it.
- Support top-level definition tables plus tables nested inside recursively safe bullet/ordered standard/task items without admitting arbitrary block children.
- Reuse the existing ProseMirror table, row, header-cell, body-cell, alignment, navigation, selection, and final-row behavior from MME-0055; do not create a second table implementation.
- Preserve untouched table bytes, definition identifier, first-line prefix, outer footnote/list indentation, line endings, unchanged sibling definition-child bytes, references, unknown syntax, and unrelated document bytes.
- Reconstruct only the containing top-level definition child or list child when a table changes; emit deterministic valid GFM pipe-table Markdown and require reparsing to the same paragraph/table/list/task hierarchy.
- Preserve table shape and alignment semantics plus representable inline cell content; reject non-rectangular, malformed, unsafe, stale, or unmappable table structures atomically.
- Keep simple, continuation-line, top-level multi-paragraph, tight/loose standard/task list, nested-list, blockquote, fenced-code, indented-code, insertion, whole-body replacement, definition selection, semantic references, identifier rename, and top-level table behavior compatible.
- Keep quote-contained tables, list items combining a table with another container child, callouts, raw HTML, and other arbitrary block children source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, invalid/inconsistent outer indentation, stale source, and unmappable ranges in explicit whole-definition source-only fallback.
- Treat one cell edit, cell navigation, or Markdown-safe final-row insertion through established table commands as truthful ProseMirror history and Save Engine state.
- Add runtime browser proof for top-level and list/task-nested table editing, keyboard navigation, undo/redo, exact Source output, save truth, unsupported fallback visibility, horizontal overflow, and constrained-width containment.
- Queue final table-in-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Unique top-level definitions containing safe rectangular GFM tables, including one table child inside safe standard/task list items, mount as semantic editable Rich definitions.
- Untouched supported definitions serialize byte-for-byte; source/layout state remains package-owned and exact source/fingerprint metadata remains absent from rendered DOM attributes.
- Editing one cell reconstructs only its bounded containing definition child or list child; unchanged definition children and unrelated source ranges remain byte-identical.
- Reconstructed Markdown remains a valid rectangular GFM table, retains alignment semantics, representable inline content, standard/task hierarchy, checked state, ordered starts, list looseness, definition prefix spelling/spacing, outer indentation, and LF/CRLF convention, and reparses to the same semantic shape.
- Existing table selection, Tab/Shift+Tab navigation, and final-cell row behavior remain reusable inside supported definitions without creating invalid Markdown or false dirty state.
- One undo reverts one table edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing footnote and top-level table tests remain green; unsupported quote-contained, mixed-container, malformed/non-rectangular, raw-HTML/callout/arbitrary-child, duplicate, unsafe, stale, invalid-indent, or unmappable definitions remain source-only and never receive partial edits.
- Schema, eligibility, serializer, table commands, and source mapping stay inside `@momentarise/md-rich-prosemirror`, remain host-independent, and pass API/architecture/security gates.
- Browser verification captures supported Rich tables before/after changes, exact resulting Source, one unsupported fallback, desktop horizontal reachability, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real table-footnote fixture and focused test that fails because safe table definitions remain source-only.
- RED: prove top-level and list/task-nested table semantics, cell edits, alignment/shape retention, exact sibling-child preservation, ordered starts, loose spacing, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove changed output reparses to the same paragraph/table/list/task hierarchy and established selection/navigation/final-row behavior works inside definitions.
- RED: prove quote-contained tables, mixed table-plus-list/quote/code items, malformed/non-rectangular tables, callouts, raw HTML, nested containers, duplicates, unsafe, stale, invalid-indent, and unmappable forms refuse atomically.
- RED: prove prior footnote definition, insertion, rename, multiline, multi-paragraph, list, nested-list, task-list, loose-list, blockquote, fenced-code, indented-code, and top-level table behavior remains compatible.
- RED: add browser/runtime assertions for cell editing/navigation, Source output, fallback visibility, save truth, horizontal reachability, and constrained containment.
- GREEN: generalize only safe table eligibility/conversion plus bounded table serialization, reusing existing table nodes, parser source ranges, child fingerprints, loose-list state, and footnote materialization.
- REFACTOR: centralize table conversion/fingerprinting for top-level and footnote use without exposing source bytes through DOM or broadening arbitrary block support.

### Manual verification

- Start the reference demo with supported top-level/list/task table definitions plus quote-contained/mixed-container unsupported definitions.
- Edit cells in Rich mode, navigate with Tab/Shift+Tab, undo/redo, save, then switch to Source and inspect exact valid nested GFM Markdown plus clean state.
- Confirm unsupported definitions remain visibly source-only, verify horizontal table reachability, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0068/`.

### Visual impact

Supported GFM tables become semantic Rich table content inside footnote definitions and safe list/task items. Unsupported quote-contained, malformed, mixed-container, and arbitrary children remain explicit preserved-source fallbacks. Final density, nested hierarchy, cell focus, keyboard feel, fallback wording, horizontal overflow, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-rich-prosemirror/package.json`, `packages/md-surface/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/004-gfm-table`, `fixtures/019-gfm-table-variants`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `fixtures/027-task-list-footnote-editing`, `fixtures/028-loose-list-footnote-editing`, `fixtures/029-blockquote-footnote-editing`, `fixtures/030-fenced-code-footnote-editing`, `fixtures/031-indented-code-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-table-editing.test.mjs`, `tests/rich-prosemirror-package.test.mjs`, `tests/rich-commands.test.mjs`, `tests/rich-core-interactions.test.mjs`, every `tests/rich-footnote-*.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, `scripts/visual-check-mme0067.mjs`, and the MME-0055 through MME-0067 build-log/visual artifacts.

Reuse the existing table ProseMirror nodes, `prosemirror-tables` behavior, parser-owned table/row/cell ranges and alignments, semantic footnote references/definitions, exact top-level definition-child source layout, child fingerprints, source-derived loose state, targeted source materialization, and conservative eligibility checks. Keep nested-table eligibility and reconstruction inside `@momentarise/md-rich-prosemirror`; do not add ProseMirror concepts to core/model/save/policy packages. Preserve untouched table bytes exactly and normalize only intentionally changed table content to deterministic valid GFM Markdown.

### Out of scope

- Quote-contained tables, multiple container children per list item, callouts, raw HTML, malformed/non-rectangular tables, or generic arbitrary-block editing inside footnotes.
- Table creation commands, row/column menus, alignment UI, merged cells, resizing, formulas, sorting/filtering, CSV/spreadsheet paste, drag reordering, structural footnote block insertion/deletion/reordering, or original pipe-spacing preservation for intentionally changed tables.
- Container-nested definitions, definition reorder, missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, task DOM redesign, top-level table UX redesign, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible table-in-footnote UX/product review is queued for the end-of-run human review block unless table range/hierarchy preservation remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0055 established the rich table model, Markdown-safe serializer, navigation, final-row behavior, and targeted table serialization; MME-0061 through MME-0067 established safe footnote/list/task child mapping, exact child-source retention, bounded reconstruction, history/save truth, and browser proof. Direct parser feasibility confirms top-level/list/task tables expose exact nested source ranges without widening public model contracts.

Accepted for code continuation 2026-07-21 after adding semantic top-level and standard/task-list table children to unique safe footnote definitions, recursive reuse of established table selection/navigation/final-row commands, exact untouched-source retention, bounded deterministic table or list-child reconstruction, alignment/shape/ordered-start/task-state/prefix/indent/LF/CRLF preservation, conservative quote/mixed-container/malformed/unsafe/duplicate/stale/unmappable refusal, truthful history/save state, package docs, real browser proof, fallback review, and full test pass. The requested exact `gpt-5.3-codex-spark` reviewer at `xhigh` reasoning hit its usage limit until 2026-07-26 and no substitute model was used; documented fallback review found and fixed missing root-CI registration for the focused test, then found no remaining P0-P3 issue. Final table density, hierarchy, keyboard feel, focus treatment, changed-table normalization, fallback wording, Source visibility, horizontal reachability, full-editor focus outline, diagnostics-chip placement, and constrained-layout taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0068 until the next backlog item is promoted.

## MME-0069 — Rich Obsidian callout footnote definition editing baseline

### Goal

Let users edit safely representable paragraph-only Obsidian callout bodies inside unique top-level footnote definitions, including one callout child inside a safe standard or task list item, while keeping callout type/title/fold semantics, Markdown source, hierarchy, unsupported fallbacks, history, and save truth intact.

### Scope

- Add a package-owned semantic ProseMirror callout node for safe Obsidian-style `> [!TYPE]` blocks inside Rich footnote definitions; do not change the public core model or parser AST contract.
- Recognize callouts only from exact source-ranged blockquotes with one safe marker line, a safe type token, optional `+`/`-` fold marker, an optional plain title, and one or more paragraph-only body lines/paragraphs.
- Render the type/title/fold header as non-editable semantic callout chrome while keeping body paragraphs editable and keyboard reachable; title/type/fold controls remain a later slice.
- Support top-level definition callouts plus one callout as the single container child after the required first paragraph in recursively safe bullet/ordered standard/task items; additional safe paragraphs remain allowed around it.
- Preserve untouched callout bytes, marker spelling/case, fold marker, title, quote spacing, definition identifier/prefix, outer footnote/list indentation, line endings, unchanged sibling definition-child bytes, references, unknown syntax, and unrelated document bytes.
- Reconstruct only the bounded containing callout child or top-level list child when callout body text changes; emit deterministic valid Obsidian callout Markdown and require reparsing to the same paragraph/callout/list/task hierarchy.
- Keep plain paragraph-only blockquotes, fenced/indented code, tables, lists/tasks, simple/multiline/multi-paragraph definitions, insertion, whole-body replacement, definition selection, semantic references, identifier rename, history, and Save Engine behavior compatible.
- Keep marker-only callouts, unsafe/malformed type/title/fold syntax, nested callouts/quotes, callouts containing lists/code/tables/raw HTML, mixed multiple-container list items, raw HTML, and arbitrary block children source-only.
- Keep container-nested definitions, duplicates, malformed definitions, unsafe content, invalid/inconsistent outer indentation, stale source, and unmappable ranges in explicit whole-definition source-only fallback.
- Add runtime browser proof for supported top-level/list/task callout body editing, semantic header/accessibility, undo/redo, exact Source output, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final callout-in-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Unique top-level definitions containing safe paragraph-only Obsidian callouts, including one callout child inside safe standard/task list items, mount as semantic editable Rich definitions.
- Callout type, optional plain title, and optional fold marker are represented as package-owned semantic node attributes and visible non-editable header content; body paragraphs remain editable without exposing exact source/fingerprint metadata through rendered DOM attributes.
- Untouched supported definitions serialize byte-for-byte. Editing one body paragraph reconstructs only its bounded callout or containing list child; unchanged definition children and unrelated source ranges remain byte-identical.
- Reconstructed Markdown retains valid `> [!TYPE]` syntax, fold state, title, paragraph boundaries, representable inline body content, standard/task hierarchy, checked state, ordered starts, list looseness, definition prefix spelling/spacing, outer indentation, and LF/CRLF convention, and reparses to the same semantic shape.
- One undo reverts one callout-body edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing plain blockquote and every prior footnote/table/code regression remain green; unsupported nested/arbitrary/malformed/unsafe/duplicate/stale/invalid-indent/unmappable callouts remain whole source-only and never receive partial edits.
- Schema, callout-source recognition, eligibility, conversion, serializer, and source mapping stay inside `@momentarise/md-rich-prosemirror`, remain host-independent, and pass API/architecture/security gates.
- Semantic callout DOM has an appropriate labelled region/aside boundary, keeps the header out of the editing surface, uses injected/tokenized styling in the demo, and remains readable at constrained width.
- Browser verification captures supported Rich callouts before/after changes, exact resulting Source, one unsupported fallback, save truth, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real callout-footnote fixture and focused test that fails because safe callout definitions remain source-only.
- RED: prove top-level and list/task-nested semantic callout attrs/body content, exact untouched identity, bounded body edits, title/type/fold retention, paragraph boundaries, ordered starts, loose/task state, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove changed output reparses to the same paragraph/callout/list/task hierarchy and semantic header metadata remains outside editable body content.
- RED: prove marker-only, malformed type/fold/title, nested callout/quote, list/code/table/raw-HTML children, mixed multiple-container items, nested containers, duplicates, unsafe, stale, invalid-indent, and unmappable forms refuse atomically.
- RED: prove prior footnote definition, insertion, rename, multiline, multi-paragraph, list, nested-list, task-list, loose-list, blockquote, fenced-code, indented-code, table, and generic callout-command fallback behavior remains compatible.
- RED: add browser/runtime assertions for semantic header/body separation, real body editing, exact Source output, fallback visibility, save truth, and constrained containment.
- GREEN: add only the package-owned callout node, exact source recognizer, safe paragraph-body mapper, and bounded callout serializer needed for the fixture.
- REFACTOR: centralize callout parsing/fingerprinting so type/title/fold/body semantics are not duplicated across eligibility, conversion, serialization, and visual proof.

### Manual verification

- Start the reference demo with supported top-level/list/task callout definitions plus nested/arbitrary/malformed unsupported definitions.
- Edit body text in Rich mode, inspect the non-editable type/title/fold header, undo/redo, save, then switch to Source and inspect exact valid nested callout Markdown plus clean state.
- Confirm unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0069/`.

### Visual impact

Supported Obsidian callouts become semantic labelled Rich blocks inside footnote definitions and safe list/task items, with a non-editable type/title header and editable paragraph body. Unsupported nested, malformed, mixed-container, raw-HTML, and arbitrary children remain explicit preserved-source fallbacks. Final density, icon/header treatment, nested hierarchy, focus flow, fallback wording, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-rich-prosemirror/package.json`, `packages/md-surface/src/index.ts`, `packages/md-theme/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/006-blockquote`, `fixtures/007-obsidian-callout`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `fixtures/027-task-list-footnote-editing`, `fixtures/028-loose-list-footnote-editing`, `fixtures/029-blockquote-footnote-editing`, `fixtures/030-fenced-code-footnote-editing`, `fixtures/031-indented-code-footnote-editing`, `fixtures/032-table-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-commands.test.mjs`, `tests/rich-input-rules.test.mjs`, `tests/rich-core-interactions.test.mjs`, every `tests/rich-footnote-*.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, `scripts/visual-check-mme0068.mjs`, and the MME-0055 through MME-0068 build-log/visual artifacts.

Current parser feasibility shows safe callouts remain source-ranged `blockquote` model nodes whose first paragraph starts with the exact marker/title line, including inside ordered/task list items. Reuse parser-owned child order/ranges, exact footnote child layouts/fingerprints, list/task reconstruction, targeted source materialization, and conservative closed eligibility. Keep callout semantics in `@momentarise/md-rich-prosemirror`; do not add ProseMirror concepts or Obsidian-specific persistence state to core/model/save/policy packages. The callout header is semantic derived-view state, while untouched source bytes remain authoritative.

### Out of scope

- Editing callout type/title/fold controls, creating callouts through a new semantic command, converting existing top-level opaque callouts, nested callouts/quotes, callout children containing lists/code/tables/raw HTML, multiple container children, or generic arbitrary-block editing inside footnotes.
- Callout icon registry, color/type theme system, custom callout aliases, collapse interaction, drag/drop, structural footnote block insertion/deletion/reordering, or original quote-spacing preservation for intentionally changed callouts.
- Raw-HTML rich editing, container-nested definitions, definition reorder, missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, task DOM redesign, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible callout-footnote UX/product review is queued for the end-of-run human review block unless source recognition, body/header separation, or bounded reconstruction remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0065 established safe paragraph-only quote mapping and bounded reconstruction; MME-0061 through MME-0068 established recursive standard/task container admission, exact child-source retention, history/save truth, and browser proof. Direct parser feasibility confirms top-level/list/task callouts expose exact source-ranged blockquotes with recoverable marker/type/fold/title/body semantics without widening public parser contracts.

Accepted for code continuation 2026-07-21 after adding package-owned semantic callout nodes for safe paragraph-only top-level and standard/task-list footnote children, non-editable accessible type/title/fold headers, body-only Rich editing, exact untouched-source retention, bounded deterministic callout or list-child reconstruction, ordered-start/task-state/prefix/indent/LF/CRLF preservation, real DOM header-exclusion proof, conservative marker-only/malformed/nested/list/raw-HTML/mixed-container/duplicate/nested-container refusal, truthful history/save state, package docs, tokenized demo styling, real browser proof, fallback review, and full test pass. The requested exact `gpt-5.3-codex-spark` reviewer at `xhigh` reasoning hit its usage limit until 2026-07-26 and no substitute model was used; documented fallback review found and fixed a DOM reparse boundary that could have admitted the visible header into editable content, then found no remaining P0-P3 issue. Final density, header/marker treatment, nested hierarchy, edit/focus flow, fallback wording, Source visibility, full-editor focus outline, diagnostics-chip placement, deep narrow wrapping, and constrained-layout taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0069 until the next backlog item is promoted.

## MME-0070 — Rich inert raw-HTML footnote block editing baseline

### Goal

Let users edit parser-recognized block HTML as inert source text inside unique top-level footnote definitions, including one raw-HTML child inside a safe standard or task list item, while preserving Markdown durability, exact untouched bytes, container hierarchy, security boundaries, history, and save truth.

### Scope

- Add a package-owned ProseMirror raw-HTML block node for exact source-ranged `raw HTML` opaque children inside Rich footnote definitions; do not change the public core model or parser AST contract.
- Present raw HTML as editable, code-like source text. Escape it through ProseMirror text content, never assign it to `innerHTML`, never activate elements, attributes, scripts, styles, URLs, custom elements, or event handlers, and never treat it as sanitized preview output.
- Support one parser-recognized block-HTML child at top-level definition depth or as the single container child after the required first paragraph in recursively safe bullet/ordered standard/task items; additional safe paragraphs remain allowed around it.
- Preserve untouched HTML bytes, tag/attribute spelling and quoting, inner whitespace, comments carried by the parser-owned range, definition identifier/prefix, outer footnote/list indentation, line endings, unchanged sibling definition-child bytes, references, unknown syntax, and unrelated document bytes.
- Reconstruct only the bounded raw-HTML child or containing top-level list child when its source text changes; reapply deterministic valid footnote/list indentation while leaving the edited HTML payload otherwise literal.
- Keep simple, multiline, multi-paragraph, list, nested-list, task-list, loose-list, blockquote, fenced/indented code, table, callout, insertion, selection/replacement, semantic-reference, identifier-rename, history, and Save Engine behavior compatible.
- Keep inline HTML mixed into paragraphs, parser-detected overlapping whole-fragment HTML, multiple raw-HTML/container children in one list item, raw HTML nested in blockquotes/callouts, container-nested definitions, duplicate definitions, stale/unmappable ranges, and ambiguous parser layouts in explicit whole-definition source-only fallback.
- Treat well-formed and malformed edited HTML as literal source truth without execution; a later remount may conservatively return malformed or no-longer-block HTML to source-only representation instead of inventing semantics.
- Add runtime browser proof for top-level/list/task raw-HTML source editing, literal DOM text, script/event-handler inertness, undo/redo, exact Source output, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final raw-HTML-in-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Unique definitions containing one exact source-ranged block `raw HTML` child at supported top-level or standard/task-list depth mount as semantic editable Rich definitions.
- Raw HTML appears as code-like editable text in a dedicated node; rendered editor DOM contains no element, attribute, script, style, URL, or event handler derived from the raw payload, and exact source/fingerprint metadata is not exposed through rendered DOM attributes.
- Untouched supported definitions serialize byte-for-byte. Editing one HTML payload reconstructs only its bounded child or containing list child; unchanged definition children and unrelated source ranges remain byte-identical.
- Valid changed examples retain literal HTML payload text, standard/task hierarchy, checked state, ordered starts, list looseness, definition prefix spelling/spacing, outer indentation, and LF/CRLF convention, and reparse to the same paragraph/raw-HTML/list/task shape.
- One undo reverts one HTML-source edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Existing top-level opaque HTML, inline HTML, HTML renderer/preview security policy, and every prior footnote/table/code/callout regression remain green; unsupported overlapping/inline/mixed-container/nested/duplicate/stale/unmappable definitions remain whole source-only and never receive partial edits.
- Schema, eligibility, conversion, serializer, and source mapping stay inside `@momentarise/md-rich-prosemirror`, remain host-independent, and pass public API, architecture, preservation, and rich-security gates.
- Raw-HTML block DOM is labelled for assistive technology, keyboard editable, code-like without claiming execution/preview, token-styled in the demo, horizontally contained at narrow widths, and exposes no active raw payload DOM.
- Browser verification captures supported Rich HTML before/after changes, exact resulting Source, one unsupported inline/mixed fallback, save truth, inert hostile payloads, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real raw-HTML-footnote fixture and focused test that fails because safe block-HTML definitions remain source-only.
- RED: prove top-level and list/task-nested semantic raw-HTML text, exact untouched identity, bounded edits, whitespace/comment/tag/attribute retention, ordered starts, loose/task state, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove valid changed output reparses to the same paragraph/raw-HTML/list/task hierarchy while hostile script/event/style/custom-element payloads remain literal text and create no active DOM.
- RED: prove inline HTML, overlapping whole-fragment detection, multiple containers, quote/callout-contained HTML, nested containers, duplicates, stale ranges, invalid indentation, and unmappable forms refuse atomically.
- RED: prove prior footnote definition, insertion, rename, multiline, multi-paragraph, list, nested-list, task-list, loose-list, blockquote, fenced-code, indented-code, table, callout, generic opaque-block, HTML renderer, and HTML preview behavior remains compatible.
- RED: add browser/runtime assertions for real HTML-source editing, literal escaped DOM content, zero payload-created executable elements/attributes, exact Source output, fallback visibility, save truth, and constrained containment.
- GREEN: add only the package-owned raw-HTML block node, strict exact-range eligibility, inert text mapper, and bounded literal serializer needed for the fixture.
- REFACTOR: centralize raw-HTML block discrimination and literal serialization so security and container rules are not duplicated.

### Manual verification

- Start the reference demo with supported top-level/list/task block-HTML definitions plus inline/mixed unsupported definitions.
- Edit tag text/attributes/body text in Rich mode, verify raw source remains code-like text rather than active HTML, undo/redo, save, then switch to Source and inspect exact valid nested Markdown plus clean state.
- Confirm hostile script/event-handler payloads remain inert and unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0070/`.

### Visual impact

Supported raw-HTML children become editable code-like source blocks inside Rich footnote definitions and safe list/task items. They do not render as HTML previews. Unsupported inline, overlapping, nested-container, mixed-container, and ambiguous forms remain explicit preserved-source fallbacks. Final density, syntax readability, hierarchy, focus flow, fallback wording, horizontal scrolling, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-rich-prosemirror/package.json`, `packages/md-render-html/src/index.ts`, `packages/md-preview-html/src/index.ts`, `packages/md-surface/src/index.ts`, `packages/md-theme/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/010-html-inline-block`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `fixtures/027-task-list-footnote-editing`, `fixtures/028-loose-list-footnote-editing`, `fixtures/029-blockquote-footnote-editing`, `fixtures/030-fenced-code-footnote-editing`, `fixtures/031-indented-code-footnote-editing`, `fixtures/032-table-footnote-editing`, `fixtures/033-callout-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-prosemirror-package.test.mjs`, `tests/rich-security.test.mjs`, `tests/render-html.test.mjs`, `tests/html-preview.test.mjs`, `tests/live-preview-mode.test.mjs`, `tests/rich-commands.test.mjs`, `tests/rich-input-rules.test.mjs`, `tests/rich-core-interactions.test.mjs`, every `tests/rich-footnote-*.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, `scripts/visual-check-mme0069.mjs`, and the MME-0056 through MME-0069 build-log/visual artifacts.

Direct parser probes confirm block HTML inside top-level, standard-list, and task-list footnote children becomes an exact source-ranged opaque node with reason `raw HTML`, nested under the owning definition/list item. Inline HTML produces separate inline opaque tags plus an overlapping detected whole fragment, and malformed or paragraph-like HTML can map ambiguously; those forms must stay source-only. Reuse exact footnote child layouts/fingerprints, recursive list/task reconstruction, targeted source materialization, and conservative closed eligibility. Keep the payload as ProseMirror text content only; do not reuse read-renderer sanitization as an editing transform and do not expose source bytes through DOM attributes.

### Out of scope

- Rich rendering or live-preview activation of inline/block HTML, standalone `.html` artifact behavior, sanitizer policy changes, HTML formatting, validation, completion, linting, syntax highlighting, element-level editing, or DOM inspection.
- Inline HTML editing, multiple raw-HTML/container children per list item, quote/callout-contained HTML, generic top-level opaque-block editing, arbitrary nested-block editing, structural footnote block insertion/deletion/reordering, or original outer indentation preservation for intentionally changed containers.
- Container-nested definitions, definition reorder, missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, task DOM redesign, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible raw-HTML-footnote UX/product review is queued for the end-of-run human review block unless literal-DOM security, parser range ownership, or bounded reconstruction remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0061 through MME-0069 established recursive standard/task container admission, exact child-source retention, deterministic bounded reconstruction, history/save truth, and browser proof. Direct parser feasibility confirms supported block HTML exposes exact source-ranged opaque children at top/list/task depth, while ambiguous inline/overlapping forms can remain atomically source-only without widening public parser contracts.

Accepted for code continuation 2026-07-21 after adding a package-owned inert raw-HTML source node for exact parser-owned top-level/list/task footnote children, paired-root eligibility through direct `parse5` validation, exact untouched-source retention, bounded deterministic raw-child/list reconstruction, ordered-start/task-state/prefix/indent/LF/CRLF preservation, hostile script/event/custom-element literal-DOM proof, conservative inline/paragraph-like/malformed/overlapping/quote/mixed/multiple/duplicate/nested-container refusal, truthful history/save state, package docs, tokenized demo styling, real browser proof, fallback review, and full test pass. The requested exact `gpt-5.3-codex-spark` reviewer at `xhigh` reasoning hit its usage limit until 2026-07-26 and no substitute model was used; documented fallback review found no remaining P0-P3 issue. Final code-source readability, hierarchy, literal-versus-preview clarity, edit/focus flow, fallback wording, Source visibility, horizontal scrolling, full-editor focus outline, diagnostics-chip placement, deep narrow wrapping, and constrained-layout taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0070 until the next backlog item is promoted.

## MME-0071 — Rich inert inline-HTML footnote paragraph editing baseline

### Goal

Let users edit parser-recognized inline HTML tags and comments as inert literal source inside otherwise safe footnote paragraphs, including safe standard/task-list, blockquote, and callout paragraph contexts, while preserving Markdown durability, exact untouched bytes, bounded reconstruction, security boundaries, history, and save truth.

### Scope

- Add a package-owned ProseMirror mark for exact source-ranged inline `raw HTML` opaque tokens inside supported Rich footnote paragraphs; do not change the public core model or parser AST contract.
- Present each HTML token as editable code-like source text. Escape it through ProseMirror text content, never assign it to `innerHTML`, never copy payload bytes into rendered DOM attributes, and never activate tags, attributes, scripts, styles, URLs, custom elements, or event handlers.
- Support single-line parser-owned inline HTML tags/comments at direct top-level definition paragraph depth, in additional safe definition paragraphs, and in recursively safe standard/task-list, paragraph-only blockquote, and safe callout-body paragraphs.
- Preserve untouched token bytes, tag/attribute spelling and quoting, comments, surrounding inline Markdown, definition identifier/prefix, outer container indentation, line endings, unchanged sibling child bytes, references, unknown syntax, and unrelated document bytes.
- Reconstruct only the bounded changed paragraph or containing top-level list/quote/callout child using existing deterministic serializers; raw-HTML-marked text serializes literally without Markdown code delimiters.
- Keep paired-fragment root overlap nodes filtered through existing strict source containment. Refuse raw HTML nested inside emphasis/strong/strike/link wrappers, multiline tokens, HTML inside table cells, ambiguous or non-exact ranges, block HTML, duplicate definitions, container-nested definitions, stale mappings, and otherwise unsafe/unmappable layouts atomically.
- Keep block raw-HTML, simple/multiline/multi-paragraph/list/nested-list/task/loose-list/blockquote/fenced/indented-code/table/callout, insertion, selection/replacement, semantic-reference, identifier-rename, history, Save Engine, renderer, and preview behavior compatible.
- Add runtime browser proof for top/list/task/quote/callout inline-HTML editing, literal code-like DOM text, hostile attribute/script-source inertness, undo/redo, exact Source output, save truth, unsupported fallback visibility, and constrained-width containment.
- Queue final inline-HTML-footnote product/taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Unique supported definitions containing exact source-ranged single-line inline `raw HTML` tokens in admitted paragraph contexts mount as semantic editable Rich definitions; paired opening/closing tokens and comments remain individually identifiable as inert marked text.
- Rendered editor DOM contains only literal token text inside package-owned code-like wrappers, no payload-derived DOM elements/attributes, and no exact source/fingerprint metadata in rendered attributes.
- Untouched supported definitions serialize byte-for-byte. Editing one token or adjacent text reconstructs only its bounded paragraph or containing child; unchanged definition children and unrelated source ranges remain byte-identical.
- Valid changed examples retain literal HTML token text, inline Markdown order, standard/task/list/quote/callout hierarchy, checked state, ordered starts, list looseness, definition prefix spelling/spacing, outer indentation, and LF/CRLF convention, then reparse to the expected same supported hierarchy.
- One undo reverts one inline-HTML edit; redo restores it; saving persists exactly the Source Markdown shown by the editor.
- Inline payloads containing script tags, event attributes, URL attributes, styles, and custom elements remain literal text and create no active payload DOM or execution path.
- Raw HTML nested inside Markdown marks/links, multiline/ambiguous tokens, table-cell HTML, block HTML, duplicates, nested containers, stale ranges, invalid indentation, and unmappable definitions remain whole source-only and never receive partial Rich edits.
- Schema/mark, eligibility, conversion, serializer, and source mapping stay inside `@momentarise/md-rich-prosemirror`, remain host-independent, and pass public API, architecture, preservation, rich-security, renderer, and preview gates.
- Inline HTML is keyboard editable, visibly code-like without claiming execution/preview, labelled for assistive technology without replacing visible content, token-styled in the demo, and contained at narrow widths.
- Browser verification captures supported Rich HTML before/after changes, exact resulting Source, one unsupported marked-wrapper/multiline fallback, save truth, inert hostile payloads, and constrained-width states.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real inline-HTML-footnote fixture and focused test that fails because otherwise safe definitions with inline raw HTML remain whole source-only.
- RED: prove top-level/multi-paragraph/list/task/quote/callout semantic text, exact token ranges, exact untouched identity, bounded token/adjacent-text edits, comments/tag/attribute retention, ordered/task/loose state, LF/CRLF, one-step undo/redo, save truth, and no full-document rewrite.
- RED: prove hostile script/event/style/URL/custom-element source remains literal marked text and creates no active DOM elements/attributes or execution.
- RED: prove raw HTML under emphasis/strong/strike/link wrappers, multiline/ambiguous tokens, table-cell HTML, block HTML, duplicates, nested containers, stale mappings, invalid indentation, and unmappable forms refuse atomically.
- RED: prove every prior footnote/block-HTML regression plus generic top-level inline-HTML behavior, HTML renderer, and sandbox preview remain compatible.
- RED: add browser/runtime assertions for real inline-token editing, literal escaped DOM content, exact Source output, fallback visibility, save truth, and constrained containment.
- GREEN: add only the package-owned inert mark, strict exact-range/single-line eligibility, literal mapper, and mark-neutral serializer behavior needed for the fixture.
- REFACTOR: centralize inline raw-HTML discrimination so security, wrapper refusal, and exact-range checks are not duplicated.

### Manual verification

- Start the reference demo with supported top-level/list/task/quote/callout inline-HTML definitions plus marked-wrapper/multiline unsupported definitions.
- Edit tag names/attributes/comments and adjacent body text in Rich mode, verify tokens stay code-like literal source rather than active HTML, undo/redo, save, then switch to Source and inspect exact valid nested Markdown plus clean state.
- Confirm hostile script/event/style/URL/custom-element payloads remain inert and unsupported definitions remain visibly source-only, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0071/`.

### Visual impact

Supported inline-HTML tokens become editable code-like source spans inside otherwise semantic footnote paragraphs and safe list/task/quote/callout hierarchy. They do not render as HTML previews. Unsupported marked-wrapper, multiline, table-cell, ambiguous, nested-container, and block forms remain explicit preserved-source fallbacks. Final density, tag/comment readability, literal-versus-rendered clarity, hierarchy, focus/selection flow, fallback wording, wrapping, and constrained-layout taste review remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-rich-prosemirror/package.json`, `packages/md-render-html/src/index.ts`, `packages/md-preview-html/src/index.ts`, `packages/md-surface/src/index.ts`, `packages/md-theme/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/styles.css`, `fixtures/010-html-inline-block`, `fixtures/020-gfm-footnotes`, `fixtures/022-simple-footnote-editing`, `fixtures/024-multiparagraph-footnote-editing`, `fixtures/025-list-block-footnote-editing`, `fixtures/026-nested-list-footnote-editing`, `fixtures/027-task-list-footnote-editing`, `fixtures/028-loose-list-footnote-editing`, `fixtures/029-blockquote-footnote-editing`, `fixtures/032-table-footnote-editing`, `fixtures/033-callout-footnote-editing`, `fixtures/034-raw-html-footnote-editing`, `tests/parser-foundation.test.mjs`, `tests/rich-prosemirror-package.test.mjs`, `tests/rich-security.test.mjs`, `tests/render-html.test.mjs`, `tests/html-preview.test.mjs`, `tests/live-preview-mode.test.mjs`, `tests/rich-commands.test.mjs`, `tests/rich-input-rules.test.mjs`, `tests/rich-core-interactions.test.mjs`, every `tests/rich-footnote-*.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, `scripts/visual-check-mme0070.mjs`, and the MME-0056 through MME-0070 build-log/visual artifacts.

Direct parser probes confirm inline HTML tags/comments inside footnote paragraphs become exact source-ranged opaque children with reason `raw HTML`; paired fragments also produce a root-level detected opaque range strictly contained by the owning definition and already removed by `filterRichRootNodes`. Existing generic paragraph conversion already keeps inline opaque text inert. Reuse exact footnote child layouts/fingerprints, recursive list/quote/callout reconstruction, targeted source materialization, and conservative source-only fallback. Keep raw tokens as marked ProseMirror text only; do not expose payload bytes through DOM attributes or reinterpret them with the read renderer.

### Out of scope

- Rich or live-preview activation of inline/block HTML, HTML validation/formatting/completion/linting, syntax trees, element-level editing, DOM inspection, standalone `.html` artifacts, sanitizer-policy changes, or React/JSX/MDX execution.
- Raw HTML inside Markdown emphasis/strong/strike/link wrappers, multiline inline tokens, table-cell HTML, generic top-level inline-HTML redesign, block raw-HTML changes, multiple arbitrary container children, structural footnote block insertion/deletion/reordering, or other arbitrary nested-block editing.
- Container-nested definitions, definition reorder, missing-reference repair, hover previews, backlink redesign, polished footnote dialogs, task DOM redesign, or docs-content construction.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible inline-HTML-footnote UX/product review is queued for the end-of-run human review block unless literal-DOM security, parser range ownership, overlap suppression, or bounded reconstruction remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Security Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0059 through MME-0070 established exact paragraph/block layouts, recursive standard/task/quote/callout reconstruction, literal raw-HTML DOM safety, history/save truth, and browser proof. Direct parser probes confirm exact single-line inline token ranges and existing strict root-overlap suppression without widening core/parser/public contracts.

Accepted for code continuation 2026-07-21 after adding a package-owned inert inline-HTML source mark for exact single-line parser-owned tokens across safe top-level/list/task/quote/callout footnote paragraphs, literal text-only hostile-payload DOM proof, exact untouched-source retention, bounded deterministic paragraph/container reconstruction, conservative Markdown-wrapper/multiline/table/block/duplicate/nested/stale/invalid-indent refusal, truthful history/save state, package docs, tokenized demo styling, real browser proof, fallback review, and full test pass. The requested exact `gpt-5.3-codex-spark` reviewer at `xhigh` reasoning hit its usage limit until 2026-07-26 and no substitute model was used; documented fallback review found and closed one P2 proof gap, then found no remaining P0-P3 issue. Final inline-token readability, literal-versus-rendered clarity, hierarchy, focus/selection flow, fallback wording, Source visibility, full-editor focus outline, diagnostics-chip placement, narrow wrapping, and constrained-layout taste remain queued for Andrew's end-of-run review block.

## MME-0072 — Rich Markdown table row operations baseline

### Goal

Let framework consumers and users insert or delete body rows in supported Rich Markdown tables through reusable package commands and reference command surfaces, while preserving Markdown as durable source, exact untouched bytes outside the owned table, deterministic serialization, nested footnote/list/task containers, history, selection, accessibility, and save truth.

### Scope

- Add package-owned, typed Rich table-row operations for inserting a body row before or after a selected/targeted body row and deleting a selected/targeted body row.
- Add context-sensitive Rich command-registry entries for insert-row-before, insert-row-after, and delete-row so framework hosts can expose the same behavior through slash, toolbar, command-palette, or custom UI without reimplementing ProseMirror table transforms.
- Reuse `prosemirror-tables` row commands and existing table lookup, selection, alignment normalization, source fingerprints, targeted serializers, and history plugins; do not hand-roll generic table transforms.
- Admit only semantic supported tables and body-row targets. Refuse header-row insertion/deletion, missing/stale targets, source-only/malformed tables, and selections outside tables without mutation.
- Preserve header cell types, column count, header-derived alignment, inline Markdown in untouched cells, exact source outside the changed table, footnote/list/task hierarchy and indentation, definition prefixes, ordered starts, task state, loose state, and LF/CRLF convention.
- Place selection in the inserted row after insertion and in the nearest valid cell after deletion, with one undo restoring the exact prior source and redo restoring the operation.
- Keep final-cell Tab row append compatible and route shared row normalization through one implementation where practical.
- Surface row commands in the reusable command registry and reference demo with accessible labels, disabled/unavailable behavior outside supported body rows, keyboard invocation, save-state proof, and constrained-width browser evidence.
- Queue final table-row command placement, wording, density, focus, selection, and constrained-layout taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Public package APIs and Rich command IDs can insert before, insert after, and delete a body row in a selected or explicitly targeted supported table; invalid/header/source-only/stale targets return the original state and report or expose an unhandled result.
- Inserted rows are rectangular, use body-cell node types, inherit normalized header alignment, serialize as Markdown-representable empty cells, and receive a predictable first/current-column selection.
- Deleting a body row preserves a valid semantic table, never deletes or demotes the header row, and leaves selection in the nearest valid cell.
- Untouched tables serialize byte-for-byte. Changed tables serialize deterministically while bytes before and after the owned table remain exact and unchanged cells retain supported inline Markdown.
- Top-level tables plus existing safe top-level/list/task footnote table contexts support row operations with exact container hierarchy, indentation, definition prefixes, ordered starts, task checked state, loose state, and LF/CRLF retention.
- One undo restores the exact pre-operation Markdown and selection-compatible table shape; redo restores the deterministic changed Markdown. Save Engine persists exactly the Source Markdown shown by the editor.
- Final-cell Tab append remains compatible and uses the same body-cell/alignment invariants as explicit insertion.
- Malformed, unsupported nested, source-only, missing, stale, header-targeted, and selection-outside-table cases do not mutate source or editor state.
- The package command registry remains host-independent; the reference slash/toolbar surfaces expose accessible row-action labels and disabled/unavailable behavior outside supported body rows without demo-only table mutation logic.
- Browser verification captures insertion before/after, deletion, undo/redo, Source output, dirty-to-clean save truth, nested table behavior, unavailable states, and constrained-width containment.
- Public API, architecture, preservation, rich-security, command-surface, Save Engine, fixture, renderer, preview, and full-suite gates pass.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real table-row fixture and focused test that fails because explicit package row-operation APIs and command IDs do not exist.
- RED: prove insert-before, insert-after, delete, selection continuity, rectangular shape, header/body types, inherited alignment, inline-mark retention, exact outside-table bytes, deterministic changed Markdown, LF/CRLF, and one-step undo/redo.
- RED: prove top-level plus safe top-level/list/task footnote table operations preserve definition/container syntax, ordered starts, task state, loose state, sibling bytes, references, and no-full-document-rewrite invariants.
- RED: prove header, malformed/source-only, unsupported nested, missing, stale, and outside-table targets refuse without mutation.
- RED: prove command registry search, run/unhandled semantics, reference slash/toolbar registration, accessible labels, context disablement, final-cell Tab compatibility, and Save Engine truth.
- RED: add browser/runtime assertions for real row insertion/deletion, undo/redo, exact Source output, clean save state, nested behavior, unavailable controls, and constrained containment.
- GREEN: add only the typed row-operation wrapper, command IDs/registry metadata, context check, shared row normalization, and reference wiring needed by the proofs.
- REFACTOR: centralize table target resolution and row alignment/selection logic so explicit commands and final-cell Tab cannot drift.

### Manual verification

- Start the reference demo with supported top-level and footnote/list/task tables plus malformed/source-only examples.
- Select body cells and invoke insert before, insert after, and delete from the reference command surfaces; verify focus moves predictably, header/alignment remains stable, unavailable contexts do not mutate, and final-cell Tab still appends one row.
- Undo/redo each operation, save, switch to Source, inspect exact deterministic Markdown and clean state, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0072/`.

### Visual impact

Supported table body cells gain accessible row-action entries in the existing command surfaces. The table itself keeps its established styling; inserted/deleted rows change only table shape and selection. Final command placement, labels, menu density, selected-cell focus treatment, narrow horizontal reachability, and constrained-layout taste remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-rich-prosemirror/package.json`, `packages/md-surface/src/index.ts`, `packages/md-surface/README.md`, `packages/md-theme/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/reference-surface.ts`, `apps/md-demo/src/styles.css`, `fixtures/032-table-footnote-editing`, `tests/rich-table-editing.test.mjs`, `tests/rich-footnote-tables.test.mjs`, `tests/rich-commands.test.mjs`, `tests/demo-slash-toolbar-baseline.test.mjs`, `tests/editor-surface-package.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, `scripts/visual-check-mme0068.mjs`, `scripts/visual-check-mme0071.mjs`, and the MME-0055/MME-0068/MME-0071 build-log and visual artifacts.

Direct feasibility probes confirm upstream `addRowBefore`, `addRowAfter`, and `deleteRow` operate on MME top-level and semantic footnote tables, and existing targeted serializers keep bytes outside the table exact. Upstream commands also permit destructive header transforms, so package-owned eligibility must reject row index `0`. Normalize every inserted body cell from the semantic header alignment, preserve one transaction/history action, and keep all mutation logic in `@momentarise/md-rich-prosemirror`; reference surfaces only consume public command metadata/results.

### Out of scope

- Column insertion/deletion/reordering, row drag/reorder, merged cells, rowspan/colspan editing, header creation/removal, alignment controls, table creation dialogs, column resizing, sorting, filtering, formulas, spreadsheet calculation, or CSV/TSV/spreadsheet paste.
- Generic blockquote-contained or otherwise unsupported nested table admission, HTML inside cells, malformed table repair, parser/model contract widening, full-document normalization, or non-Markdown table adapters.
- Final table visual redesign, mobile touch handles, polished context menus, command-surface redesign, docs-content construction, or public-release copy.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Accessibility Reviewer, and UX Reviewer allowed; code review must use exactly `gpt-5.3-codex-spark` at `xhigh` when available.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible table-row command/product review is queued for the end-of-run human review block unless source ownership, header protection, bounded serialization, history, or save truth remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Accessibility Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0055 established semantic top-level table editing, navigation, final-cell row append, deterministic changed-table serialization, and Save Engine truth. MME-0068 extended the same exact source ownership and bounded reconstruction to safe top-level/list/task footnote table contexts. Direct `prosemirror-tables` probes confirm row transforms are viable inside those states; strict body-row eligibility closes the observed unsafe header-transform behavior.

Accepted for code continuation 2026-07-22 after adding typed body-row insert-before/after/delete APIs and Rich command IDs, strict body/header/stale/missing/outside-table eligibility, upstream ProseMirror table transforms, header-derived body-cell alignment, predictable inserted/nearest surviving selection, one-step history, exact untouched and bounded deterministic top-level/direct/list/task serialization, LF/CRLF and Save Engine truth, final-cell Tab compatibility, reusable accessible More/slash wiring, disabled unavailable states, viewport-clamped More-menu placement, dedicated fixture/browser evidence, exact Spark/xhigh review, and a full test pass. The reviewer found no P0-P3 issue; three residual proof/UX gaps were closed by adding bottom-edge menu placement, dedicated fixture 036 visual coverage, and final-body-row deletion selection proof. Final command placement/labels, More/slash density, selected-cell focus, wide horizontal reachability, full-editor focus outline, diagnostics-chip overlap, far-right-scroll composition, and constrained-layout taste remain queued for Andrew's end-of-run review block. No executable normal issue remains after MME-0072 until the next backlog item is promoted.

## MME-0073 — Rich Markdown table column operations baseline

### Goal

Let framework consumers and users insert or delete columns in supported Rich Markdown tables through reusable package commands and reference command surfaces, while preserving Markdown as durable source, exact untouched bytes outside the owned table, deterministic serialization, semantic header/body cell types, nested footnote/list/task containers, history, selection, accessibility, and save truth.

### Scope

- Add package-owned, typed Rich table-column operations for inserting a column before or after a selected/targeted column and deleting a selected/targeted column.
- Add context-sensitive Rich command-registry entries for insert-column-before, insert-column-after, and delete-column so framework hosts can expose the same behavior through slash, toolbar, command-palette, or custom UI without reimplementing ProseMirror transforms.
- Reuse `prosemirror-tables` column commands and existing table lookup, selection, source fingerprints, targeted serializers, row-operation availability patterns, and history plugins; do not hand-roll generic table transforms.
- Admit only semantic supported tables. Refuse missing/stale targets, source-only/malformed tables, selections outside tables, invalid rows/cells, and deletion of the only remaining column without mutation.
- Preserve rectangular row shape, header-cell type in the semantic header, body-cell types elsewhere, untouched cell content/inline Markdown, exact source outside the changed table, footnote/list/task hierarchy and indentation, definition prefixes, ordered starts, task state, loose state, and LF/CRLF convention.
- Give inserted columns deterministic neutral alignment and Markdown delimiters. Place selection in the inserted column after insertion and in the nearest valid surviving column on the same row after deletion.
- Keep MME-0055/MME-0072 cell navigation, final-cell Tab append, and row operations compatible.
- Surface column commands in the reusable command registry and reference demo with accessible labels, disabled/unavailable behavior outside supported table cells or when deleting the only column, keyboard invocation, save-state proof, and constrained-width browser evidence.
- Queue final table-column command placement, wording, density, focus, selection, horizontal scrolling, and constrained-layout taste review for Andrew's end-of-run human review block.

### Acceptance criteria

- Public package APIs and Rich command IDs can insert before, insert after, and delete a column in a selected or explicitly targeted supported table; invalid/source-only/stale/outside-table targets return the original state and report or expose an unhandled result.
- Inserted columns keep every row rectangular, use header cells in the first row and body cells elsewhere, use deterministic neutral alignment, serialize as Markdown-representable empty cells, and receive a predictable current-row selection.
- Deleting a column never removes the only remaining column, never deletes/demotes the header row, and leaves selection in the nearest valid surviving column on the same row.
- Untouched tables serialize byte-for-byte. Changed tables serialize deterministically while bytes before and after the owned table remain exact and untouched cells retain supported inline Markdown and alignment.
- Top-level tables plus existing safe direct/list/task footnote table contexts support column operations with exact container hierarchy, indentation, definition prefixes, ordered starts, task checked state, loose state, and LF/CRLF retention.
- One undo restores the exact pre-operation Markdown and table shape; redo restores deterministic changed Markdown. Save Engine persists exactly the Source Markdown shown by the editor.
- Existing row insert/delete, cell edit/navigation, Shift+Tab, and final-cell Tab append behavior remains compatible.
- Malformed, unsupported nested, source-only, missing, stale, invalid-coordinate, outside-table, and one-column delete cases do not mutate source or editor state.
- The package command registry remains host-independent; reference slash/toolbar surfaces expose accessible column-action labels and context disablement without demo-only table mutation logic.
- Browser verification captures insertion before/after, deletion, undo/redo, Source output, dirty-to-clean save truth, nested table behavior, unavailable/one-column states, horizontal reachability, and constrained-width containment.
- Public API, architecture, preservation, rich-security, command-surface, Save Engine, fixture, renderer, preview, and full-suite gates pass.
- `docs/internal/build-log.md` records RED/GREEN evidence, visual impact, reviewer or fallback result, tests, residual risks, commit, push status, and next issue.

### Test-first plan

- RED: add a real table-column fixture and focused test that fails because explicit package column-operation APIs and command IDs do not exist.
- RED: prove insert-before, insert-after, delete, selection continuity, rectangular shape, header/body cell types, neutral inserted alignment, untouched alignment/inline-mark retention, exact outside-table bytes, deterministic changed Markdown, LF/CRLF, and one-step undo/redo.
- RED: prove top-level plus safe direct/list/task footnote table operations preserve definition/container syntax, ordered starts, task state, loose state, sibling bytes, references, and no-full-document-rewrite invariants.
- RED: prove malformed/source-only, unsupported nested, missing, stale, invalid-coordinate, outside-table, and only-column deletion targets refuse without mutation.
- RED: prove command registry search, run/unhandled semantics, reference slash/toolbar registration, accessible labels, context disablement, row-operation/navigation compatibility, and Save Engine truth.
- RED: add browser/runtime assertions for real column insertion/deletion, undo/redo, exact Source output, clean save state, nested behavior, unavailable controls, horizontal reachability, and constrained containment.
- GREEN: add only the typed column-operation wrapper, command IDs/registry metadata, context checks, selection normalization, and reference wiring needed by the proofs.
- REFACTOR: share table target/dispatch utilities with row operations only where it reduces duplication without weakening their distinct eligibility rules.

### Manual verification

- Start the reference demo with supported top-level and direct/list/task footnote tables, a one-column table, and malformed/source-only examples.
- Select header/body cells and invoke insert before, insert after, and delete from reference command surfaces; verify focus moves predictably, row/header types and existing alignments remain stable, only-column/outside-table contexts do not mutate, and row/Tab behavior still works.
- Undo/redo each operation, save, switch to Source, inspect exact deterministic Markdown and clean state, then repeat at constrained width and capture artifacts under `docs/internal/visual-checks/MME-0073/`.

### Visual impact

Supported table cells gain accessible column-action entries in the existing command surfaces. Inserted/deleted columns change table width and selected-cell position without redesigning the table. Final command placement, labels, menu density, selected-cell focus treatment, horizontal reachability, and constrained-layout taste remain queued for Andrew's end-of-run review block.

### Implementation notes

Read first: `packages/md-format/src/index.ts`, `packages/md-core/src/index.ts`, `packages/md-editor/src/index.ts`, `packages/md-rich-prosemirror/src/index.ts`, `packages/md-rich-prosemirror/README.md`, `packages/md-rich-prosemirror/package.json`, `packages/md-surface/src/index.ts`, `packages/md-surface/README.md`, `packages/md-theme/src/index.ts`, `apps/md-demo/src/main.ts`, `apps/md-demo/src/reference-surface.ts`, `apps/md-demo/src/styles.css`, `fixtures/036-table-row-operations`, `tests/rich-table-editing.test.mjs`, `tests/rich-table-row-operations.test.mjs`, `tests/rich-footnote-tables.test.mjs`, `tests/rich-commands.test.mjs`, `tests/demo-slash-toolbar-baseline.test.mjs`, `tests/demo-table-row-commands.test.mjs`, `tests/surface-components.test.mjs`, `tests/rich-targeted-serialization.test.mjs`, `tests/save-engine.test.mjs`, `scripts/visual-check-mme0072.mjs`, and the MME-0055/MME-0068/MME-0072 build-log and visual artifacts.

Direct feasibility probes confirm upstream `addColumnBefore`, `addColumnAfter`, and `deleteColumn` transform MME top-level and semantic direct/list/task footnote tables while existing serializers keep bytes outside the table exact. Upstream insertion creates correct header/body cell types and neutral alignment, but leaves selection on the original cell; deletion can move selection to an unrelated row. The package wrapper must normalize selection into the inserted or nearest surviving column on the target row. Upstream refuses deletion of a one-column table; expose that boundary explicitly as package availability/failure state. Keep all mutation logic in `@momentarise/md-rich-prosemirror`; reference surfaces only consume public command metadata/results.

### Out of scope

- Column or row drag/reorder, merged cells, rowspan/colspan editing, header creation/removal, alignment controls, column resizing, sorting, filtering, formulas, spreadsheet calculation, or CSV/TSV/spreadsheet paste.
- Generic blockquote-contained or otherwise unsupported nested table admission, HTML inside cells, malformed table repair, parser/model contract widening, full-document normalization, or non-Markdown table adapters.
- Final table visual redesign, mobile touch handles, polished context menus, command-surface redesign, docs-content construction, or public-release copy.

### Execution model

- Implementation: sequential only.
- Fresh context rebuild required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, Accessibility Reviewer, and UX Reviewer allowed; code review must use exactly `gpt-5.3-codex-spark` at `xhigh` when available.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no for code continuation; final visible table-column command/product review is queued for the end-of-run human review block unless source ownership, cell-type preservation, bounded serialization, history, or save truth remains unresolved.

### Reviewer

Architecture Reviewer, Test Reviewer, Accessibility Reviewer, and UX Reviewer.

### Blocked by

- None. MME-0055 established semantic table editing/navigation/serialization, MME-0068 extended bounded nested-table reconstruction, and MME-0072 established reusable structural table commands, context availability, one-transaction history, and shared reference wiring. Direct `prosemirror-tables` probes confirm column transforms and the one-column refusal boundary on current MME states.

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
