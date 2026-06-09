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
- Fresh agent required: yes, unless the human explicitly continues the same conversation for that issue.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
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
- Fresh agent required: yes.
- Reviewer subagents: UX Reviewer, Architecture Reviewer, Test Reviewer, DX Reviewer, and Security/License Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this defines the product/editor surface before adapters.

### Reviewer

UX Reviewer, Architecture Reviewer, Test Reviewer, DX Reviewer, and Security/License Reviewer.

## Renumbering note (2026-06-09)

The public-framework readiness review inserted new issues before adapter work:

- Previous `MME-0019 — Theia adapter alpha` is now `MME-0034`.
- Previous `MME-0020 — Host adapter external-change strategy` is now `MME-0035`.

Phases: A integrity (0019–0022), B headless engine and packaging (0023–0024), C contracts (0025–0027), D surface and bindings (0028–0031), E product surfaces (0032–0033), F adapters (0034–0035), G publish and docs (0036–0038).

## MME-0019 — Rich-mode round-trip fidelity gate

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
- Fresh agent required: yes.
- Reviewer subagents: Test Reviewer and Architecture Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless fidelity cannot be proven for a fixture class.

### Reviewer

Test Reviewer and Architecture Reviewer.

## MME-0020 — Targeted rich serialization and no-rewrite saves

### Goal

A rich edit must change only the edited blocks in the persisted Markdown. No full-document normalization on edit, autosave, copy, or mode switch.

### Scope

- Map ProseMirror transactions to touched top-level blocks via parse-time source ranges.
- Serialize only dirty blocks and splice them with the existing `serializeMarkdownEdits` source-range mechanism.
- When `richChanged` is false, `getMarkdown()`, copy, download, and save must return the untouched baseline source.
- Flush with reason `mode-switch` on mode changes, per the Save Engine contract.

### Test-first plan

- RED: edit one heading in rich mode on a mixed fixture; assert every other line is byte-identical. Assert copy-in-untouched-rich-mode equals the original source.

### Acceptance criteria

- Editing one block in rich mode preserves all unrelated source bytes, including list markers, blank-line runs, setext headings, and emphasis style outside the edited block.
- Untouched rich documents produce zero byte changes through save/copy/download.
- Autosave after a rich edit writes only the targeted change to the save target.
- Mode switch uses the `mode-switch` flush reason.
- Round-trip and edited-range suites pass.
- Visual impact: no visible UI change; behavior-only preservation fix.

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Test Reviewer and Architecture Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the preservation contract for rich editing.

### Reviewer

Test Reviewer and Architecture Reviewer.

## MME-0021 — Rich list and todo editing baseline

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this changes core rich editor feel.

### Reviewer

UX Reviewer and Test Reviewer.

## MME-0022 — Source-mode keymap integrity

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless source-editing behavior regresses.

### Reviewer

Test Reviewer.

## MME-0023 — Headless editor session and events

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Architecture Reviewer, Test Reviewer, and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this defines the public core API.

### Reviewer

Architecture Reviewer.

## MME-0024 — Publishable package restructure

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Architecture Reviewer and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because dependency policy is an architecture decision.

### Reviewer

Architecture Reviewer and DX Reviewer.

## MME-0025 — Theming contracts: tokens, host theme, icon set

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Architecture Reviewer, UX Reviewer, and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this sets the public theming direction.

### Reviewer

Architecture Reviewer and UX Reviewer.

## MME-0026 — Preferences, settings locks, and capability contracts

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Architecture Reviewer, DX Reviewer, and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless lock semantics are ambiguous.

### Reviewer

Architecture Reviewer and DX Reviewer.

## MME-0027 — Extension registry V0

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Architecture Reviewer, DX Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is public extension API.

### Reviewer

Architecture Reviewer and DX Reviewer.

## MME-0028 — Editor surface package with i18n and accessibility

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: UX Reviewer, Architecture Reviewer, Test Reviewer, and DX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the reusable product surface.

### Reviewer

UX Reviewer and Architecture Reviewer.

## MME-0029 — Block interaction affordances

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is signature block UX.

### Reviewer

UX Reviewer.

## MME-0030 — Beautiful default theme V1

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: DX Reviewer and Architecture Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless binding API shape is contentious.

### Reviewer

DX Reviewer.

## MME-0032 — Markdown HTML renderer and inline-HTML policy

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: UX Reviewer and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no.

### Reviewer

UX Reviewer.

## MME-0034 — Theia adapter alpha

Previously numbered MME-0019.

### Goal

Integrate the same core into Theia as a real adapter consuming the headless session and surface packages.

### Acceptance criteria

- Theia adapter uses the same core packages, `@momentarise/md-editor` session, and `@momentarise/md-surface` components.
- Opening `.md` works; source mode works; saving works through a Theia-backed `SaveTarget`.
- No duplicated parser/serializer/orchestration logic.
- Keybindings delegate to the Theia keybinding service per the MME-0026 `delegateToHost` mode.

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Architecture Reviewer, UX Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless adapter integration changes core boundaries.

### Reviewer

Architecture Reviewer.

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Architecture Reviewer and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this defines adapter behavior and user trust around external edits.

### Reviewer

Architecture Reviewer.

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: DX Reviewer and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because licensing is a human decision.

### Reviewer

DX Reviewer and Security Reviewer.

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: DX Reviewer and UX Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, for the linking convention and public boundary.

### Reviewer

DX Reviewer.

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

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: UX Reviewer, DX Reviewer, and Security Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: yes, because this is the public face and an external-link surface.

### Reviewer

UX Reviewer and DX Reviewer.

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
- Toolbar visibility, density, contextual behavior, settings/host configuration, and command grouping.
- Source/Rich/Live Preview naming and transitions.
- Replace demo-style segmented mode buttons with an editor-grade compact toggle, icon button, status menu, or host-configurable mode picker.
- Mode controls must be document-kind aware: Markdown exposes relevant Source/Rich/Live Preview choices; HTML exposes Source/Preview without disabled/confusing Rich mode.
- Unify `Open .md` and `Open .html` into one Open action with type detection or a secondary menu/filter.

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
- Collaboration positioning: public statement that CRDT/collab is future work; the block-level targeted-edit invariant keeps the door open and must not be broken.
- Vue/Svelte bindings after `@momentarise/md-react` stabilizes.
- Optional settings UI components (headless settings state + reference DOM components); hosts keep owning settings presentation.
- VS Code/Cursor extension adapter (webview reusing the web build) and Chrome extension candidate.
- Vim mode hook, typewriter/focus modes, word/character stats surface.
- Rich-mode live rendering of inline/block HTML inside Markdown where policy allows (render-sanitized; source preserved), beyond the MME-0032 read-only renderer.
- Link editing popover and docs-page link autocomplete (extends MME-0038 internal linking).
- Migration guides (from Tiptap, BlockNote, plain textarea) and StackBlitz example embeds.
- Mobile/tablet input pass: virtual-keyboard toolbar, touch selection, gesture affordances.
- Performance budgets and large-document benchmarks (10k-line documents; incremental parse/serialize; debounced status checks).

### Potential future splits

- Editor live preview parity.
- Toolbar/slash/menu final UX.
- Unified Open flow and file-type routing.
- HTML preview reading polish.
- Plain text/lightweight file adapter.
- Office/PDF/Google Docs adapter research.
- Document status/save truth UI.
