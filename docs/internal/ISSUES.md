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

## MME-0018 — Theia adapter alpha

### Goal

Integrate the same core into Theia.

### Acceptance criteria

- Theia adapter uses same core packages.
- Opening `.md` works.
- Source mode works.
- Saving works.
- No duplicated parser/serializer logic.

### Execution model

- Implementation: sequential only.
- Fresh agent required: yes.
- Reviewer subagents: Architecture Reviewer, UX Reviewer, and Test Reviewer allowed.
- Parallel implementation: forbidden unless human-approved.
- Human review required: no, unless adapter integration changes core boundaries.

### Reviewer

Architecture Reviewer.

## MME-0019 — Host adapter external-change strategy

### Goal

Define and prove the host-adapter contract for external document changes without moving host-specific watching into the core.

This issue was added after MME-0011.5 from product discussion: local web, Theia/IDE, database-backed apps, and Chrome extensions do not observe external changes the same way.

### Scope

- Define the adapter-level contract for external changes: focus refresh, polling, host file events, realtime sync events, and save-time hash verification.
- Document which strategies apply to `@momentarise/md-adapter-web`, `@momentarise/md-adapter-theia`, `@momentarise/md-adapter-vscode`, and future `@momentarise/md-adapter-chrome-extension`.
- Keep the core Save Engine responsible for hashes, dirty state, conflict state, and safe no-overwrite behavior.
- Keep host watchers, browser extension APIs, IDE file services, and database realtime subscriptions out of core packages.
- Document that adapters may register MME as the default Markdown reader/editor when the host allows it, without making the core assume default-editor ownership.

### Acceptance criteria

- PRD explains that external-change handling is adapter-owned.
- Adapter contract distinguishes local-file, IDE, database/realtime, and Chrome extension strategies.
- Web adapter has a documented hybrid plan: focus refresh, optional polling, and save-time verification.
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

### Potential future splits

- Editor live preview parity.
- Toolbar/slash/menu final UX.
- Unified Open flow and file-type routing.
- HTML preview reading polish.
- Plain text/lightweight file adapter.
- Office/PDF/Google Docs adapter research.
- Document status/save truth UI.
