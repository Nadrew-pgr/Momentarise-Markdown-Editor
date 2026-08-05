# Momentarise Markdown Editor Backlog

This file is the product backlog for ideas, must-have editor coverage, future slices, and research notes that are not yet ready to become implementation issues.

`docs/internal/ISSUES.md` remains the executable issue queue. Do not turn this file into a second issue tracker. When an item becomes clear enough to build, promote it into `ISSUES.md` with normal acceptance criteria, gates, visual impact, tests, and reviewer plan.

Some backlog items are not "nice to have". They are baseline editor hygiene: their absence would make MME feel incomplete, even if their presence does not create a wow moment. Use the classification on each item:

- `baseline/hygiene`: required for a serious public Markdown editor.
- `product-differentiator`: part of MME's core promise.
- `future-adapter`: adapter or host-shell work that can happen after core readiness.
- `research`: needs design, technical, legal, or product investigation.
- `maybe-later`: useful but not required for public framework credibility.

## Baseline / Hygiene Requirements

These are Markdown editor fundamentals. They do not all need to land in the next slice, but they must not be treated as optional polish before MME claims public editor readiness.

### Tables

Tags: `baseline/hygiene`, `markdown`, `rich-mode`, `live-preview`, `round-trip`

- Preserve GFM pipe tables byte-for-byte when untouched.
- Preserve unsupported or non-standard table syntax as raw Markdown instead of flattening or destroying it.
- Render tables properly in read mode and live preview.
- Keep source mode as the truth and fallback for every table form.
- Rich mode must never silently convert a table into lossy paragraphs.
- Rich cell editing, keyboard navigation, final-cell row append, explicit body-row insert/delete, explicit column insert/delete, row/column reorder, and strict spreadsheet/TSV clipboard paste are implemented in MME-0055/MME-0072/MME-0073/MME-0074/MME-0075. Quoted CSV clipboard paste is promoted as `MME-0080`; HTML-table paste and file conversion remain backlog.
- Tests must include real table fixtures, edited-neighbor preservation, and round-trip proof.

### Footnotes / Endnotes

Tags: `baseline/hygiene`, `markdown`, `navigation`, `round-trip`

- Preserve GFM-style `[^ref]` references and definitions.
- Render footnotes/endnotes in read mode and live preview.
- Support backlink navigation in rendered views.
- Keep source mode fallback for editing unusual footnote syntax.
- Future rich editing should include insertion and edit affordances without hiding the Markdown source model.
- First rich editing slice for existing simple definitions promoted as `MME-0056`; new footnote insertion is promoted as `MME-0057`; identifier rename is promoted as `MME-0058`; top-level continuation-line editing is promoted as `MME-0059`; top-level multi-paragraph editing is promoted as `MME-0060`; standard list-block editing is promoted as `MME-0061`; nested standard list editing is promoted as `MME-0062`; task-list editing is promoted as `MME-0063`; loose/list-spread and multi-paragraph list items are promoted as `MME-0064`; safe paragraph-only blockquotes are promoted as `MME-0065`; safe fenced code blocks are promoted as `MME-0066`; safe indented code blocks are promoted as `MME-0067`; safe table blocks are promoted as `MME-0068`; safe paragraph-only Obsidian callouts are promoted as `MME-0069`; inert block-HTML source editing is promoted as `MME-0070`; inert inline-HTML paragraph source editing is promoted as `MME-0071`; other arbitrary nested blocks remain backlog.
- Tests must include real footnote fixtures and parser/source/rich round-trip proof before claiming coverage.

### Core Markdown Blocks

Tags: `baseline/hygiene`, `markdown`, `editing`

- H1-H6 headings, paragraphs, thematic breaks, blockquotes, code fences, inline code, links, images, ordered lists, unordered lists, nested lists, task lists, frontmatter, raw HTML, Mermaid, LaTeX, wikilinks, callouts, and unknown syntax must preserve safely.
- Unsupported syntax should become raw/opaque where needed, not corrupted editable content.
- Live preview should update common Markdown constructs without requiring a source/rich mode bounce.
- Raw inline and block HTML inside Markdown should eventually render where policy allows while preserving source bytes. This is distinct from opening a standalone `.html` artifact.
- Callouts, opaque blocks, inserted media, and document-end content need explicit editing affordances so users are not trapped inside or below framed blocks.

#### Rich serializer defects measured during MME-0104a (2026-08-04)

Three findings, each measured against the built package and each verified to
reproduce at `fe828c9` — before MME-0104a — so none is caused by the input
rules. None is in MME-0104a's acceptance criteria; each needs its own issue with
its own RED.

- **Adjacent runs sharing an outer mark serialize one delimiter pair each.**
  *Resolved by MME-0121 (2026-08-05) — run grouping in both rich serializers,
  including the table-cell/footnote-definition path this note did not know
  about. Kept for history.* `wrapMomentariseTextMarks` wraps every ProseMirror
  text node independently, so
  bolding across an existing code span produces ``**a ****`x`**** b**`` instead
  of ``**a `x` b**``. Reachable today with no input rule at all: load
  `` a `x` b ``, select the paragraph, run the `bold` command. Preservation-critical
  — `test:roundtrip`, `test:rich-fidelity`, `test:rich-targeted-serialization`
  and the footnote/table suites all cover this path.
- **A trailing fenced code block loses the document's final newline.**
  `serializeRichMarkdownState` emits ``` ```ts\nconst value = 1;\n```\n ```, but
  after the same content is typed in the demo `session.getContent()` returns it
  without the final `\n`, while every other block type keeps one. Measured
  identical at `HEAD` before MME-0104a. Lives in the session/save layer, not the
  rich serializer.
- **Literal block and inline syntax is serialized unescaped in paragraphs, so an
  undo does not survive a save.** *Resolved by MME-0120 (2026-08-05,
  commit `62480e8`) — verify-then-escape in the model serializer. Kept for
  history; the classes escaping cannot fix are recorded under
  "Model-serializer defects measured during MME-0120".* Measured:

  | Typed, then one undo | Editor shows | Serializes | Re-parses as |
  | --- | --- | --- | --- |
  | `# ` | `# ` | `#` | an **empty heading** — the characters are gone |
  | `3. ` | `3. ` | `3.` | an **empty ordered list** — the characters are gone |
  | `[] ` | `[] ` | `[]` | paragraph `[]` (trailing space dropped) |
  | `**bold**` | `**bold**` | `**bold**` | `<strong>bold</strong>` — the undo is reversed |
  | `a**bold**` (mid-word, never converted) | `a**bold**` | `a**bold**` | `a<strong>bold</strong>` |

  So MME-0104a's "one undo restores the literal typed text" holds on screen and
  until the next save, and then does not. Table cells already escape correctly
  (`\>`), so the gap is the paragraph text serializer, not the concept. Fixing
  it means escaping leading block markers and inline delimiter runs when a
  paragraph's literal text would re-parse as something else.

#### Other contract-5 gaps measured during MME-0104a (2026-08-04)

- **Inline marks cannot be typed inside a table cell.** `richTextInputContext`
  reports `table-cell` unsafe, which is what stops `> ` and `- ` from destroying
  the table — but it also blocks `**bold**` there, so a writer cannot format
  table text by typing. Splitting the contract into "no block conversions" and
  "inline marks are fine" would close this; it needs its own RED, because the
  block half is the corruption guard.
- **The next keystroke after a thematic break destroys it.** `---` leaves a
  `NodeSelection` on the `horizontal_rule`, so typing `---dash` yields a document
  containing only `dash`. Pre-existing; the rule's selection offset is unchanged
  by MME-0104a.
- **Delimiters adjacent to punctuation never convert.** `(**bold**)`,
  `"**bold**"` and `-**bold**` stay literal because the word-boundary guard
  accepts only a block start or whitespace, which is exactly what MME-0104a's
  criterion specifies. Notion converts all three. Widening it needs CommonMark's
  left/right-flanking delimiter-run rule rather than a looser character class:
  simply allowing punctuation reintroduces `*italic*` swallowing `**bold**`,
  because mid-typing `**bold*` has `*` before the match. This gets worse once
  MME-0104b pairs `(`.
- **`listTodo` has no one-step undo.** Converting a list item with `[x] ` inside
  an existing list records no undo text, so `Mod-z` falls through to history.
  Pre-existing shape; every other rule in the table now records one.
- **The `link` input rule discards marks inside `[...]`.** It replaces the match
  with fresh text, unlike the emphasis rules which delete delimiters and mark
  what is left. Low blast radius today only because the word-boundary guard
  stops `**b**` converting inside the brackets first.

#### Model-serializer defects measured during MME-0120 (2026-08-05)

Findings measured against the built package while fixing serializer escaping;
each verified to reproduce at `e11b8e8` unless noted, each outside MME-0120's
scope (escaping), each needing its own RED. The first two are data loss.

- **Nested todo items are indented by the checkbox width, and list items are
  destroyed.** `serializeMomentariseListItem` indents an item's child blocks by
  `marker.length + 1`, but for a task item the marker it measures is `- [x]`,
  where `[x]` is content rather than a marker. Nested items land at six spaces
  instead of two, deep enough to stop being a nested list. Measured on
  `003-gfm-task-list` through `serializeMomentariseDocument`: **5 list items in,
  3 out** — two items merged into their parent's paragraph text. Reachable
  wherever a rich edit reconstructs a task list. Confirmed independently by the
  MME-0120 Test Reviewer.
- **A multi-line setext heading loses its second line.** `---` under two lines
  of text is a level-2 setext heading whose content spans both lines, and no
  ATX heading can hold a newline, so `## owner: docs-team\nstatus: review`
  re-parses as a heading plus a paragraph. Measured on `014-mixed-real-world`.
  No escape can fix it; the repair is to emit setext when a heading's content
  is multi-line. MME-0120's verifier detects the case and returns the original
  bytes rather than adding backslashes that would not help.
- **A bare URL cannot be held as literal text.** remark-gfm claims it as an
  autolink literal even when every ASCII punctuation character is escaped:
  `\[label\]\(https\:\/\/example\.com\)` still parses as text plus a link. So a
  writer who types `[label](https://example.com)` and undoes the conversion
  gets a link back on the next load. The bytes round-trip unchanged, so this is
  a shape defect rather than character loss; fixing it needs a different
  mechanism from escaping — probably an opaque inline span. Asserted as a
  known limitation in `tests/serializer-escaping.test.mjs`, and the reason two
  `output.includes(...)` assertions in `tests/live-preview-mode.test.mjs` are
  the honest maximum for their inputs.
- **`linkReference` serializes its children without brackets.** `[ref]` reaches
  the model serializer's default case and flattens to `ref` — a pre-existing
  loss of the reference syntax (MME-0120 reviewer, measured). Preservation-
  relevant; also the reason reference-link paragraphs cannot verify and are
  emitted verbatim by the escaping tiers.
- **Whitespace normalization bounds what escaping can preserve.** Four or more
  leading spaces re-parse as indented code and a space has no backslash escape;
  a trailing space at the end of a block is dropped by serializer and parser
  alike; a text-node value containing `\n\n` or a trailing two-space run
  re-opens as two blocks / text plus a break. All pre-existing normalization,
  not character loss. An entity (`&#32;`, as the table-cell serializer already
  uses where pipes force it) would technically survive — measured — but
  writing entities into user files was judged worse than the normalization.
- **The performance budgets never run the model serializer.**
  `scripts/performance-benchmarks.mjs`'s `serializeLargeDocument` measures
  `createMarkdownAstFormatter().serialize`, the identity formatter, and
  `richSerializeLargeDocument` measures an untouched document (zero
  reconstruction). A regression in `serializeMomentariseDocument` is invisible
  to every budget (MME-0120 reviewer, measured: an 85x slowdown passed the full
  chain; fixed by the fast path, but the coverage gap remains). Adding a
  model-serializer operation to the budgets needs its own slice.

#### Selection bubble overlaps the sticky toolbar at coarse-pointer widths (2026-08-05)

Measured while building MME-0121's browser gate; pre-existing layout behaviour
(the change under test touched serialization only, no CSS or DOM). At 390×844
with touch emulation, selecting the first line of a document places the
selection bubble (MME-0089) over the sticky rich toolbar: bubble rect
48..240 × 127..181 versus the toolbar's bold button at 116..160 × 108..152.
The bubble's own controls work, but its padding swallows taps aimed at the
covered toolbar buttons beneath — a writer aiming at the (visible) sticky
toolbar hits dead space. Belongs with the block-affordance/mobile work
(MME-0109 audit territory). The MME-0121 gate documents the geometry in
`docs/internal/visual-checks/MME-0121/README.md` and uses the bubble at that
width, which is the interaction that works.

#### Rich mount defects measured by the MME-0121 reviewer (2026-08-05)

Measured against the built package while reviewing MME-0121; all pre-existing
(the change under review touched serialization, not mounting), each needing its
own RED. The first is data loss.

- **Mounting drops model `lineBreak` nodes entirely.** `inlineNodeToProseMirror`
  handles only the `"break"` spelling but the parser emits `"lineBreak"`
  (measured: `paragraph[text("a"), lineBreak, text("b")]` for both a
  backslash-newline and a two-space break; the mounted ProseMirror doc holds the
  merged text `"ab"`). Any edit to such a paragraph silently joins the lines on
  save. Three whitelists in the same file accept both spellings — spelling
  drift between producer and consumer.
- **Mounting drops marks on images and hard breaks.** `image.create` /
  `hard_break.create` receive no marks argument, so loading
  `**a ![alt](i.png) b**` and editing the paragraph serializes the image
  outside the bold run. MME-0121's one-pair guarantee therefore holds for
  command-applied marks; loaded documents re-fracture through the mount gap
  until the mount passes marks through.
- **Emphasis runs starting or ending with whitespace serialize delimiters that
  do not re-parse** (md-format level, pre-existing; identical model shapes
  under the old wrapper): unbolding the middle of a bolded phrase yields
  `**a **x** b**`, which re-opens with the unbold reversed; italic applied
  over `" c"` yields `* c*`, literal asterisks. Needs CommonMark
  flanking-aware delimiter placement or whitespace shifting.
- **Adjacent same-destination links merge into one link at mount** (ProseMirror
  mark model; near-equivalent semantics). Note only.

#### Todo item presentation (2026-08-04)

Seen in MME-0104a's own 390 capture, and not caused by it — no stylesheet is in
that diff. At coarse-pointer widths the todo toggle renders at the MME-0117
touch-target size and **overlaps the start of its own label**, and at every width
todo items are indented deeper than sibling bullet and ordered items. Belongs
with the block-affordance/mobile work.

### Core Editor Interactions

Tags: `baseline/hygiene`, `editing`, `mobile`, `desktop`

- Undo/redo, selection, copy/paste, Enter, Backspace, Tab/Shift+Tab indentation, drag/drop where applicable, keyboard shortcuts, and document-end insertion must be reliable.
- Lists and todos must continue, indent, outdent, split, and exit predictably.
- Source, Rich, and Live Preview editing ergonomics must be consistent enough that users do not feel like they are switching between unrelated products.
- Enter, Backspace, paste, selection, and undo/redo must remain predictable around headings, lists, todos, quotes, code blocks, callouts, opaque blocks, inserted media, and document end.
- Indentation/outdent with Tab/Shift+Tab must work across nested bullet lists, ordered lists, and todos.
- Shared `todo_item` DOM semantics for standalone, bullet/ordered, nested, and footnote tasks are implemented as `MME-0077`, including native list structure, content-isolated parsing, list-wrapped creation, and native button focus/state behavior.
- Package-owned block insertion before/after current framed blocks and keyboard/root-click insertion after final framed content are implemented in MME-0013.5/MME-0042; exact final-block preservation and browser proof cover code, opaque/callout, table, raw HTML, and inserted-media cases.
- The first mobile/tablet viewport and coarse-pointer reachability baseline was implemented in `MME-0078`; full mobile rich-editor, platform keyboard, gesture, and native-shell work remains backlog.

### Link Insertion On Paste Over A Selection

Tags: `baseline/hygiene`, `editing`, `links`, `rich-mode`

Requested by Andrew, 2026-08-03.

- Pasting a URL while text is selected must wrap the selection in a Markdown link (`[selection](pasted-url)`) instead of replacing the selected text with the URL. This is the behavior of the Claude Code desktop composer, Notion, Slack, and Linear, and its absence is a moment where MME feels unfinished against products users already have in their hands.
- In rich mode the selection then reads as a link affordance (highlighted, activatable); in source mode the same paste produces the same Markdown bytes. Both paths must serialize to identical source.
- Scope questions to settle before promotion: what counts as a URL (scheme allowlist vs permissive), behavior when the selection already contains a link, behavior when the selection spans blocks, and whether a non-URL paste over a selection keeps today's replace behavior.
- Preservation rule applies: this is a targeted edit over the selected range, never a document rewrite.

## Core Product Differentiators

These are not generic polish. They are part of why MME exists instead of using a plain Markdown viewer/editor.

### Slash Menu

Tags: `product-differentiator`, `must-have`, `commands`, `ai`

- Slash command is a core MME surface, not a nice-to-have.
- It should cover block insertion, formatting commands, document actions, AI entry points, and future host-provided commands.
- It must be keyboard-first, searchable/fuzzy, grouped clearly, visually polished, and usable on constrained/mobile surfaces.
- Hosts should be able to configure available commands without forking MME internals.

### Toolbar / Bubble Toolbar

Tags: `product-differentiator`, `must-have`, `formatting`, `settings`

- Toolbar and selection/bubble toolbar are core editing surfaces.
- Default behavior should feel premium, with host-configurable visibility, density, command groups, iconography, and mobile behavior.
- Toolbar settings belong in the host/preferences contract, not hardcoded demo-only state.
- Toolbar behavior must cover normal visibility, contextual visibility, selection state, disabled states, grouping, keyboard access, and mobile/constrained layouts.

### Obsidian-Class Live Preview

Tags: `product-differentiator`, `baseline/hygiene`, `live-preview`

- Target at least Obsidian default Live Preview behavior while keeping real Markdown as the source of truth.
- Markdown typed in rich/live preview should render in place where safe and predictable.
- Source mode must remain available for exact control.
- Live preview refresh must cover common constructs typed in rich mode, including headings, todos, lists, quotes, links, and code fences, without requiring a source/rich mode bounce.
- Keep Momentarise differentiation: toolbar, slash command, better structured block layer, and `.md` as source of truth.

### Mode Controls

Tags: `product-differentiator`, `baseline/hygiene`, `settings`, `document-kind`

- Source/Rich/Live Preview naming and transitions need a final product decision.
- Replace demo-style segmented mode buttons with an editor-grade compact toggle, icon button, status menu, or host-configurable mode picker.
- Mode controls must be document-kind aware: Markdown exposes relevant Source/Rich/Live Preview choices; HTML exposes Source/Preview without disabled or confusing Rich mode.
- Hosts should be able to choose the mode-switching pattern through preferences/settings.

### AI Editing Surface

Tags: `product-differentiator`, `ai`, `policy`, `settings`

- AI should be available from the editing surfaces users actually use: slash menu, toolbar, selection menu, command palette, and configured host entry points.
- Slash `/ai` should open an inline AI prompt surface anchored under the current block/line: a focused free-text prompt box first, then action rows/buttons such as continue writing, draft, rewrite, improve, summarize, translate, checklist, and table. This should feel like BlockNote/Copilot/Gemini-class in-document assistance, not a detached debug panel.
- AI must remain assistive: suggested changes need explicit review/apply flows.
- BYOK, hosted backend, sidecar, and disabled AI modes must all fit the adapter/host policy model.
- Provider status must be explicit. The current demo mock session must not imply that pasting an OpenAI, Gemini, Mistral, or other provider key will call that provider unless a real host/provider adapter is configured.

## Reading, Preview, And Status Surfaces

### HTML Preview / Reading Surface

Tags: `baseline/hygiene`, `html`, `reading`, `preview`

- Remove permanent technical HTML status strips or banners from the normal reading surface.
- Keep sandbox/script/save truth discoverable through a discreet status affordance, inspector, hover/detail menu, toast, or debug surface.
- Avoid nested/conflicting scroll regions and large blank preview gutters.
- Preview should use the available app viewport naturally for daily reading, not device/debug controls.
- Standalone HTML artifact preview and inline/block HTML inside Markdown are separate product cases.

### Folding / Document Structure

Tags: `baseline/hygiene`, `navigation`, `editing`

- Folding polish should be benchmarked against Obsidian and CodeMirror-style left-gutter affordances.
- Fold controls should live in a subtle editor gutter/margin, appear on hover/focus, avoid heavy borders/shadows, and use a minimal collapsed marker such as `...`.
- Heading folding should be hierarchical for H1-H6: folding a heading hides its child section until the next same-or-higher heading.
- Nested parent/child fold state should remain predictable when parents collapse and expand.

### Document Status / Save Truth

Tags: `baseline/hygiene`, `save-engine`, `status`, `settings`

- The permanent document metadata/status section must not remain normal editor chrome for every opened file type.
- Move file name, URI, adapter kind, writability, persistence target, and save details into an editor-grade status pattern while preserving save truthfulness.
- Evaluate an optional bottom-right word/character counter that can be shown, hidden, or disabled by host/settings.
- Unify `Open .md` and `Open .html` into one Open action with type detection or a secondary menu/filter, while keeping persistence truth explicit.
- Add a `New file` / `Save As` flow for creating new Markdown documents.
- When the host supports writable file creation, `New file` / `Save As` should create a real writable `.md` target and make subsequent Save/autosave write to that file.
- When the host cannot create writable files, the UI must fall back to export/download copy and clearly say the document is not persisted to the original disk target.
- Host adapters should decide their own creation mechanism: browser File System Access, Theia/IDE file service, desktop OS save panel, backend storage, or explicit download-only mode.

## Future Adapters And Format Expansion

Tags: `future-adapter`, `research`

- Theia, VS Code/Cursor-like IDE shells, Chrome extension, Electron/Tauri desktop shell, and mobile/tablet host shells.
- Plain text and adjacent source-like files: `.txt`, `.text`, `.log`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, `.toml`. The first source-only routing slice is promoted as `MME-0052`; semantic previews, validation, formatting, and conversion remain future work.
- SVG reader/preview: treat `.svg` as a lightweight visual document candidate, with sanitized or sandboxed rendering, no script execution, safe handling for event handlers and external references, and clear source/preview behavior.
- Document formats: `.docx`, `.pptx`, Google Docs, PDF, and similar formats. Each must declare whether it is preview-only, import-to-Markdown, export-from-Markdown, or true round-trip editable with a format-preserving adapter.
- Vanilla/Vite/any-bundler and React/Next are not backlog adapters by themselves: they consume framework-agnostic packages directly or via bindings. Only host shells and additional framework bindings live here.
- Vue and Svelte bindings can follow after `@momentarise/md-react` stabilizes.
- Chrome extension support should include permission limits, file access limits, and whether MME can become a default Markdown reader/editor in supported contexts.
- Desktop host shells should cover OS file IO, secure key storage, OS `.md` file association, auto-update, and adapter-owned external-change strategies through SaveTarget-style contracts.
- Mobile/tablet host shells need a touch/layout pass: virtual-keyboard toolbar, touch selection, gestures, and constrained viewport behavior.
- Keep conversion provenance and lossiness visible for all non-Markdown formats.
- Warn before overwrite/export if conversion may lose layout, comments, tracked changes, speaker notes, formulas, embedded media, or source-format semantics.
- Never claim an imported/converted document was saved back to the original source format unless the adapter actually did that.

### Document-to-Markdown Converter Product

Tags: `future-adapter`, `product-differentiator`, `research`, `conversion`, `monetization`

- Build a likely open-source converter layer around MME for PDF, DOCX, Google Docs, TXT, and adjacent formats into clean Markdown.
- Keep the local/core converter open and inspectable where possible; monetize the hosted web converter above a usage threshold rather than locking the basic conversion path.
- Treat the web converter as a separate product surface from the editor: upload/import, conversion diagnostics, cleaned Markdown output, provenance, lossiness warnings, and copy/download/export actions.
- Consider adjacent Markdown tools after the core converter works: batch conversion, cleanup/normalization, metadata/frontmatter extraction, Markdown-to-format export, and targeted document modifications.
- Preserve MME truthfulness: converted output is a new Markdown artifact unless a real adapter can write back to the source format.

## Consumability, Distribution, And Host Adoption

Source: external integrator feedback (CallInt agent evaluation, 2026-07-30) plus repository verification. See `docs/internal/VISION.md` for the vision-level framing.

Promotion status 2026-07-30: this section's items were promoted into the `ISSUES.md` Active Queue re-plan — StrictMode fix as `MME-0081`; CI/publish-readiness/publication as `MME-0082`/`MME-0083`/`MME-0084`; registry consumer example as `MME-0085`; diff/patch as `MME-0092`; revision store as `MME-0093`. Editor UX corrections from the 2026-07-30 tour are `MME-0086`-`MME-0091`; docs/site/blog tier work is `MME-0094`-`MME-0097`. Same-day additions: the inline AI writing surface (backlog "AI Editing Surface") is promoted as `MME-0098`; the Payload CMS plugin/integration research item is promoted as `MME-0099`. Benchmark audits below remain a pre-launch review gate.

### Package Publication And Consumability

Tags: `public-release`, `baseline/hygiene`, `dx`, `must-have`

- Verified 2026-07-30: nothing is published on npm, `dist/` is gitignored and absent from any installable artifact, no package defines `prepare`/`prepack`, and the configured remote is 151 commits (about one month) behind local `main`. The framework is currently consumable only from this machine.
- Push the remote and keep it pushed; the local laptop must not be the only copy of the repository.
- Build a release pipeline: version management (changesets or equivalent), tarball packing with built `dist/` and types, CI that builds, tests, packs, and smoke-installs the tarballs.
- Publish `0.x` alpha packages under the `@momentarise/` scope once the pipeline proves tarball correctness; keep the compatibility promise truthful about instability.
- After first publication, consumer smoke tests must also run against the registry artifacts, not only packed workspace tarballs.
- Resolved 2026-07-30 (MME-0083): the pnpm-strict peer-dependency mismatch noted below is fixed. Root cause was isolated to `vite@^8` alone (a bare `vite` devDependency in an empty pnpm project reproduces the identical `[ERR_PNPM_PEER_DEP_ISSUES]` — Rolldown's bundled `@napi-rs/wasm-runtime@1.2.0` wants `@emnapi/core`/`@emnapi/runtime@^2.0.0-alpha.3`, but pnpm's default resolution installs `1.11.1` because a separate, unrelated consumer elsewhere in Vite's own tree requests `^1.x`), not any `@momentarise/*` package. Fixed by adding both to `pnpm-workspace.yaml`'s `overrides` in every pnpm-strict consumer leg (`scripts/consumer-smoke.mjs`'s `externalPeerOverrides`). The CI workflow's "Consumer matrix" step is re-added.
- Historical note (verified 2026-07-30 during MME-0082, before the MME-0083 fix above): `scripts/consumer-smoke.mjs`'s pnpm-strict consumer leg failed on real GitHub Actions ubuntu-latest with the same `[ERR_PNPM_PEER_DEP_ISSUES]`. The CI "Consumer matrix" step was temporarily removed during MME-0082 (outside that issue's own acceptance criteria) and re-added here once fixed.
- Resolved 2026-07-30/31 (MME-0084): all 16 public packages published to npm as `0.1.0-alpha.1` under the `alpha` dist-tag, `--access public`. `latest` also points at the alpha release because npm always assigns `latest` to a package's first-ever publish and rejects removing a package's only dist-tag — this will self-correct once a real stable `0.1.x` publishes.
- Verified 2026-07-31 (MME-0085): `@momentarise/md-react`'s `MarkdownEditor`/`useMarkdownEditor` always mounts only the CodeMirror source view (`mountReactEditor` in `packages/md-react/src/index.ts` never wires in `@momentarise/md-rich-prosemirror`). The built-in mode-control widget still renders Source/Rich/Live Preview buttons and `session.setMode()` updates the session's mode state, but clicking "Rich" does not currently mount a different editing surface in the React binding. Not a regression from this issue (pre-existing scope of `md-react` as a "thin binding"; the `react.md`/`next.md` quickstarts never claimed rich-mode support), but worth a dedicated follow-up issue if/when `md-react` is meant to expose rich mode.

### React StrictMode Session Lifecycle

Tags: `baseline/hygiene`, `react`, `bug`, `must-have`

- Verified 2026-07-30 in `packages/md-react/src/index.ts`: `useMarkdownEditor` creates the session lazily during render and the unmount effect calls `session.destroy()` without resetting `sessionRef.current`. Under React StrictMode double-invocation (React 18/19, Next.js App Router default), the remounted component reuses a destroyed session.
- Reproduce with a StrictMode React fixture first (RED), then fix the lifecycle so session creation/destruction is StrictMode-safe.
- Add React 19 / current-Next integration coverage to consumer smoke tests.
- Strong promotion candidate for the next must-have implementation issue.

### Host Document APIs — Diff, Patch, And Revisions

Tags: `product-differentiator`, `host-adoption`, `research`

- Expose a public diff/patch contract over documents. The bounded-serialization and edited-range machinery already exists internally; the gap is a stable public API hosts can call.
- Make `DocumentRevision` a usable contract: today it is only a brand type in `md-core`. Define a minimal revision/version-store interface with host-owned storage, aligned with the existing `SaveState`/hash vocabulary.
- External integrators already mirror `DocumentSnapshot`, `DocumentHash`, `SaveState` (`dirty|saving|saved|conflict|error`), and `PolicyCapability`; treat that vocabulary as a de facto public contract and keep it stable.
- Collaboration/CRDT remains future work, but these contracts must not close that door.

### World-Class UX Benchmark Audits

Tags: `public-release`, `ux`, `human-review`

- Before public launch, audit each user-facing surface (toolbar, slash menu, tables, lists, live preview, mobile, folding, status chrome) side by side against BlockNote, Notion, and Obsidian, not only against internal acceptance criteria.
- Record per-surface parity gaps as backlog items with screenshots of both MME and the benchmark.

## Public Face: Demo, Landing, And Docs Product

Source: Andrew, 2026-07-31, after reviewing the demo app, the landing page, and the docs site. Research basis: `docs/internal/research/editor-ux-benchmark.md`.

### Demo as a product surface, not an engineering bench

Tags: `public-release`, `product-differentiator`, `must-have`

- Andrew's verdict on `apps/md-demo` as a public face: "ce n'est pas une démo" — it is an engineering bench (diagnostics pill, debug toggles, fixture chrome, every control visible at once), and it is worse on mobile than on desktop.
- Direction approved by Andrew: build a `/demo` page on the docs site as the public demo. One pre-filled document showing headings, lists, todos, a table, a callout, and code — and nothing else on screen. Touch-first quality is part of the acceptance, not a follow-up.
- Landing CTAs become two, deliberately non-salesy: "Play with the demo" and "Documentation".
- `apps/md-demo` stays as the internal development bench and keeps its diagnostics; it is no longer the thing anyone is invited to look at.

### Docs: principles before mechanics

Tags: `public-release`, `dx`, `ax`

- Andrew's request: replace/extend the `Foundations` docs section with `Principles` (or `Concepts`) — same pages, but each one states **why this decision was made**, in the author's voice, before explaining the mechanics. Rationale is what makes a framework trustworthy and citable; mechanics alone read as a manual.
- Candidate principle pages, one decision each: why Markdown stays the durable source; why rich editing is a derived view; why HTML is an artifact and never the source; why save state must name its real target; why unknown syntax is preserved instead of normalized; why the core stays host-independent; why AI writing is policy-gated and staged.
- Fold into `MME-0095` (docs IA) rather than a separate issue, and keep the existing page content — this is a framing and ordering change plus new rationale prose, not a rewrite.

### Docs credibility details

Tags: `public-release`, `dx`

- Verified 2026-07-31: `apps/docs-site` genuinely depends on `@momentarise/md-render-html`, `md-editor`, `md-save`, `md-source-codemirror`, and `md-theme` at `^0.1.0-alpha.3`, and renders documentation through `DocsPageView`. A "Built with Momentarise Markdown Editor" footer line is therefore a truthful claim, not marketing. Add it.
- Andrew's readability concern: the docs read as machine-organized rather than human. Schedule a joint human pass with Andrew over the docs IA and copy — his judgment is the acceptance criterion, and he has said he is not the technical audience, so unexplained jargon is a defect.
### Dogfooding goal: the docs site should be buildable from published packages alone

Tags: `public-release`, `product-differentiator`, `dx`, `must-have`

Andrew, 2026-07-31: "is the site made purely with MME? we should be able to build this kind of thing with MME — it would be the first tangible proof."

Measured state on that date. What is genuinely MME: every documentation page's content is rendered by `renderMarkdownToHtml` from `@momentarise/md-render-html` (canonical Markdown in, HTML out — the core claim, dogfooded); design tokens come from `@momentarise/md-theme/tokens.css`; the live editor embeds are real `md-editor`/`md-save`/`md-source-codemirror` sessions. What is not: the entire shell (top bar, sidebar, breadcrumbs, on-this-page, search, theme toggle, mobile nav) is bespoke docs-site React; 1711 lines of docs-site CSS of which only 359 references consume `--mme-*` tokens, and the site imports `tokens.css` but not the packaged `styles.css`; and `rendered-html.ts` is 95 lines of regex post-processing over MME's HTML output — stripping the first `h1`, injecting heading anchors, rewriting internal links, decorating external ones.

So today the site proves MME renders Markdown well. It does not yet prove MME gives you the pieces to build a documentation product. Making the second claim true is a strong differentiator and a strong public proof — "this documentation site is built entirely from published `@momentarise/*` packages" is a sentence competitors cannot copy cheaply.

Target, to be split into issues alongside `MME-0094`/`MME-0095`:

- Promote the `rendered-html.ts` post-processors into a package (heading anchors, safe in-doc link rewriting, external-link decoration, section metadata), so hosts stop reimplementing DOM rewriting. This supersedes the existing "Reusable docs rendering post-processors" backlog line.
- Provide docs content primitives expressible from Markdown or safe extensions — callouts, steps, tabbed code blocks, comparison tables, card grids — instead of docs-site-only React fragments. Supersedes the existing "Native docs content primitives" line.
- Make the docs site consume the packaged `styles.css`, not just tokens, and cut bespoke CSS down to genuine site chrome.
- Define explicitly what stays host-owned (routing, navigation data, search index, deployment) so the claim is precise rather than overstated.
- Acceptance for the claim: a fresh project can reproduce a docs page with anchors, internal links, callouts, and a live editor using published packages only, proven by a temp-dir build like the registry consumer tests.


## Governance debt — queued, not yet applied (2026-08-02)

Findings from two independent audits (this project's internal-docs review, and the CallInt project's protocol retrospective) that are real but not yet written into the rules. Recorded here so they are not carried in memory. Each line is an instruction to write, not a topic to discuss.

Already applied on 2026-08-02 and NOT repeated here: shipped-issue status markers, block-table-only ordering, block hard-stop in every instruction file, RED must be the assertion's own failure, mutation proof with a valid-mutant definition, reachability, build-log claims re-read from the repository, reviewers mandatory and explicitly read-only, evidence parity for every "the tool was unavailable" claim, issue-ID allocation, gates-with-self-invokable-exceptions, reviewer-dies-mid-review procedure, fixed reviewer brief template, tree frozen during review, out-of-scope findings escalated, guards proved falsifiable, contract-versus-verified-state separation, corrections update the contract, gate enforcement ships first, forbidden agent behaviors, `SUPERSEDED` decisions, fix-issue naming, and a structured home for raised-but-not-queued findings.

Still to write:

- **Parallel agents.** Disjoint top-level paths declared in the plan; one worktree and branch per agent; no two agents in the same block; nobody edits `ISSUES.md`, `build-log.md`, `QUALITY_GATES.md` except by appending their own section; a path conflict is a stop, never a negotiation; integration review runs on the merged result, not on either branch.
- **Session recovery.** A new, compacted, or crashed session starts by reconstructing state from `git status`, `git log`, and the last five build-log entries verified against the repository — a build-log entry whose commit does not exist is a false claim. Uncommitted work is an interrupted issue of unknown state: run its checks, report what passes. Output a Recovery Report before editing. If repository and build log disagree, stop and ask. Never resume by re-implementing.
- **Split trigger.** An issue is too big when it needs more than one RED-GREEN cycle on unrelated behaviors, when the real file set exceeds the plan by more than half or crosses an unnamed architecture boundary, when acceptance cannot be proven by one demonstrable path, or when two distinct human decisions surface inside it. Split into `-a`/`-b` children, mark the original superseded, record the trigger, implement only the first child. Quietly narrowing acceptance criteria instead is a false done with extra steps.
- **Dependency and licence gate.** A new dependency is an Open Decision: record what it does, why existing code is insufficient, its SPDX licence, last release, transitive count, and removal cost. Copyleft in a product intended for closed distribution is a hard stop. No licence file means unusable. Lockfile committed in the same commit; subagent review mandatory for any runtime dependency.
- **Human correction protocol.** The human decides product, priority, and acceptance — not facts. When an instruction contradicts something verifiable, say so once with the evidence, then comply and record both the disagreement and the decision. A gate waiver is valid only when recorded with gate ID, scope, reason, and expiry. Three instructions are never followed regardless of source: marking an issue accepted without evidence, committing a secret, and deleting or rewriting evidence to make a state look better than it is.
- **Public-readiness gate.** First public exposure is human-only and gated on: a cold-reader docs review passed by an agent that never read the source, every gate green with no active quarantine and no expired `pending`, a secret scan across full git history, the private-docs boundary confirmed, licence consistency, every public surface enumerated and covered by a proof CI runs, README status matched against the build log, and a stated support posture. The readiness report may not be written by an agent that built the surface it certifies.
- **Flaky tests.** A test that passes and fails on the same commit is a defect in the test. Never retry until green, never skip without an owning issue; record both outputs and treat it as a P1 finding.
- **Destructive operations.** No history rewrite, hard reset on shared history, branch or remote deletion, data-dropping migration, or `rm -rf` outside a build output directory without explicit human approval in the current session.
- **Skill language.** The `dev-workflow` skill was translated to English on 2026-08-02; audit for any remaining French that would hide duplicate rules from text search.


### Interview-driven candidates (2026-08-04, source: docs/internal/research/docs-rationale-2026-08-04.md)

- **Hybrid command-ID typing** (`dx`, D6): built-in command IDs become a typed union/const map exported by `md-editor`/`md-surface` (autocomplete, typo safety); host and agent IDs stay open strings under the `host:` convention. Non-breaking. Andrew: "Q7 en hybride j'aime bien !!"
- **Save-state simplification pass** (`research`, D4): the six-target taxonomy is accidental complexity from build difficulties, not doctrine. Keep the truth rule ("saved" never lies), reduce the taxonomy. Needs its own design pass.
- **Reference localization dictionaries** (`dx`, `i18n`, O2 — pending série 3): `MmeStrings`/`defaultMmeStrings` exist in `md-surface` but are essentially undocumented publicly, and no French dictionary ships despite Andrew's FR/EN ICP. Decide shipped languages, ownership, docs language.
- **Payload CMS docs-host decision** (`research`, O3 — pending série 3, blocked on Andrew): reconcile "canonical docs are plain `.md` in the repo" with "all the docs has to be managed in Payload" (Andrew's declared first use case). Likely shape: Payload stores and round-trips real Markdown through MME contracts — which is the product's own pitch. Feeds MME-0099.

### Todo checkbox overlap at 390px (measured 2026-08-04 during MME-0104b)

Tags: `baseline/hygiene`, `ui`, `mobile`

The 390px screenshot from `visual:mme-0104b` shows todo checkboxes overlapping their own labels. The MME-0104b diff contains no CSS, so it is pre-existing — but `[] ` now makes todos one keystroke away, so it is much easier to reach. Promotion candidate for Block D (fits MME-0089/0091 surface work); fix lands in the packaged stylesheet per the styling ownership rule.

## Public Framework Follow-Ups

Tags: `public-release`, `dx`, `ax`, `research`

- Agent-indexable repository/docs discovery was implemented in `MME-0076`: concise public README, root agent compatibility entrypoint, stable `llms` and `/agent/*` URLs, static artifact serving, robots/sitemap, metadata, and truthful source-code structured data.
- Agent retrieval/adoption content hardening was implemented in `MME-0079`: query-oriented README/public guidance, direct FAQ boundaries, citation-safe LLM routes, a generated product profile, and an adoption-evaluation skill. Search ranking, citation guarantees, package publication, Payload integration, and public launch remain outside the slice.

### End-Of-Run Human Review Queue

Tags: `public-release`, `human-review`, `ui`, `ax`

- MME-0038 explicit public-face validation debt: review docs IA, visual quality, copy, external-link behavior, AX claims, CLI guidance, and light/dark screenshots before public launch.
- MME-0048 public docs launch validation: review package API checkpoint pages, AX/Ask AI/skills/CLI truthfulness, Open-in-chat/external-link behavior, light/dark docs screenshots, mobile screenshots with the floating round `N` overlay, and whether the MME-0038 public-face validation debt is now acceptable before public launch.
- MME-0044 visible file/status workflow review: review unified Open, New File, Save As, imported-copy/export fallback wording, dirty/conflict actions, status popover density, and browser prompt ergonomics before public launch.
- MME-0045 command-surface UX review: review toolbar density/icon grouping, slash menu ranking/group labels, selection bubble placement, mode control variants, mobile wrapping, and final product feel before public launch.
- MME-0046 HTML preview product review: review the normal standalone HTML reading surface, details affordance placement, constrained-width feel, save/export wording, and whether the preview chrome feels public-ready before launch.
- MME-0047 folding product review: review gutter density beside block handles, collapsed marker taste for headings/code/callouts/opaque blocks, keyboard focus treatment, nested fold feel, and whether folding feels public-ready before launch.
- MME-0049 AX artifact distribution review: review generated `docs/agent/manifest.json`, `docs/agent/actions.json`, and `docs/agent/skills/*/SKILL.md` as public/distribution artifacts; confirm skill naming, action labels, Open-in-chat target list, future action descriptors, and not-installed-automatically wording before public launch.
- MME-0050 performance budget review: review whether the broad CI thresholds should remain smoke guards, whether the generated fixture is representative enough for release claims, and whether future browser/mobile/virtualization benchmarks should be promoted before public launch.
- MME-0051 upload/storage UX review: review the public asset-upload provider contract, storage-provider examples, privacy wording, pending/failure semantics, visible paste/drop/upload UX, and whether a first-party demo upload provider should be added before public launch.
- MME-0052 lightweight source UX review: review `.txt/.log/.json/.yaml/.toml` open/import/save wording, source-only mode labeling, unsupported-file rejection wording, properties/diagnostics copy, and whether syntax-specific previews or validation should be promoted before public launch.
- MME-0053 SVG artifact preview review: review `.svg` open/import/save wording, Source/Preview mode labeling, sanitized-preview details, visible preview chrome, and whether sanitizer warnings are understandable enough before public launch.
- MME-0054 visible asset upload UX review: review Insert image placement, slash/paste/drop discoverability, success/error/pending feedback, demo-provider wording, local `./assets/...` references, and whether a real first-party example provider is required before public launch.
- MME-0055 rich table product review: review cell density, alignment presentation, Tab/Shift+Tab feel, selected-cell focus treatment, final-row insertion, wide-table horizontal scrolling, malformed/nested fallback wording, constrained layout, and whether advanced row/column actions should be promoted before public launch.
- MME-0056 rich footnote product/AX review: review definition label density, semantic reference presentation, dedicated reference role/navigation expectations, keyboard-only focus treatment, preserved complex-definition wording, constrained layout, and whether insertion/rename/multi-block editing should be promoted before public launch.
- MME-0057 rich footnote insertion review: review command placement and naming, deterministic generated identifiers, focus transfer between reference and definition, keyboard flow, source visibility, constrained layout, and whether identifier rename should be promoted next.
- MME-0058 rich footnote rename review: review rename entry-point placement, identifier input/validation wording, multi-reference feedback, focus continuity, Source visibility, constrained layout, and whether complex definition editing should be promoted next.
- MME-0059 multiline footnote review: review continuation-line presentation, definition density, edit/focus flow, fallback wording for multi-paragraph and nested definitions, Source visibility, and constrained layout.
- MME-0060 multi-paragraph footnote review: review paragraph spacing, definition density, edit/focus flow, nested-block fallback wording, Source visibility, constrained layout, the dominant full-editor blue focus outline, and the floating technical-diagnostics chip overlapping narrow content.
- MME-0061 list-footnote review: review list indentation, marker density, item editing/selection flow, definition spacing, unsupported complex-list fallback wording, Source visibility, full-editor focus outline, diagnostics-chip placement, and constrained layout.
- MME-0062 nested-list footnote review: implementation accepted for code continuation; review nested hierarchy readability, bullet/ordered marker density, deep-item editing/selection flow, definition spacing, task/loose-item fallback wording, Source visibility, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap on constrained content, and constrained layout.
- MME-0063 task-list footnote review: implementation accepted for code continuation; review nested task hierarchy, checked/unchecked control density, deep-item text/state editing, keyboard and pointer toggle flow, definition spacing, loose/arbitrary fallback wording, Source visibility, full-editor focus outline, diagnostics-chip placement, and constrained layout.
- MME-0064 loose-list-item footnote review: implementation accepted for code continuation; review multi-paragraph item spacing, loose-list density, nested paragraph/list hierarchy, standard/task item readability, edit/focus flow, arbitrary-block fallback wording, Source visibility, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap on constrained task content, deep narrow-width wrapping, and constrained layout.
- MME-0065 blockquote-footnote review: implementation accepted for code continuation; review quote-marker density, multi-paragraph separation, quote/list/task nesting readability, edit/focus flow, callout/nested/arbitrary fallback wording, Source visibility, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap on lower constrained content, deep narrow-width wrapping, and constrained layout.
- MME-0066 fenced-code-footnote review: implementation accepted for code continuation; review code-block density, language/meta visibility, top-level/list/task hierarchy, multiline editing/focus flow, long-fence normalization, indented-code/mixed-container fallback wording, Source visibility, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap on constrained task content, code horizontal scrolling, deep narrow-width wrapping, and constrained layout.
- MME-0067 indented-code-footnote review: implementation accepted for code continuation; review code-block density, top-level/list/task hierarchy, multiline editing/focus flow, deterministic four-space normalization after edits, fenced/table/mixed-container fallback wording, Source visibility, full-editor focus outline, diagnostics-chip placement, code horizontal scrolling, deep narrow-width wrapping, and constrained layout.
- MME-0068 table-footnote review: implementation accepted for code continuation; review table density, top-level/list/task hierarchy, cell editing and Tab/Shift+Tab flow, selected-cell focus treatment, final-row insertion, deterministic changed-table normalization, quote/malformed/unsafe/mixed-container fallback wording, Source visibility, horizontal reachability, the observed full-editor blue focus outline, the observed diagnostics-chip overlap at constrained width, deep narrow-width wrapping, and constrained layout.
- MME-0069 callout-footnote review: implementation accepted for code continuation; review callout density, marker/type/title/fold header treatment, top-level/list/task hierarchy, body-only editing and focus flow, deterministic changed-callout normalization, malformed/nested/list/raw-HTML/mixed-container fallback wording, Source visibility, the observed full-editor blue focus outline, the observed diagnostics-chip overlap at constrained width, deep narrow-width wrapping, and constrained layout.
- MME-0070 raw-HTML-footnote review: implementation accepted for code continuation; review code-like source readability, top-level/list/task hierarchy, literal-versus-preview clarity, script/event-handler inertness messaging, edit/focus flow, horizontal scrolling, inline/overlapping/nested/mixed fallback wording, Source visibility, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap at constrained width, deep narrow-width wrapping, and constrained layout.
- MME-0071 inline-HTML-footnote review: implementation accepted for code continuation; review inline tag/comment readability, literal-versus-rendered clarity, top-level/list/task/quote/callout hierarchy, hostile attribute/script-source inertness, script-body Markdown emphasis hiding underscore bytes in Rich display while Source remains exact, edit/focus/selection flow across tag boundaries, selected-token viewport clipping before focus clears, marked-wrapper/multiline/ambiguous fallback wording, Source visibility, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap at constrained width, narrow wrapping, and constrained layout.
- MME-0072 table-row operations review: implementation accepted for code continuation; review insert-before/after/delete placement and labels, More/slash density, unavailable-state clarity, selected-cell/focus continuity, undo/redo feel, final-cell Tab compatibility, nested table reachability, wide-table horizontal scrolling, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap at constrained width, the intentionally far-right-scrolled wide-table composition, and constrained layout.
- MME-0073 table-column operations review: implementation accepted for code continuation; review insert-before/after/delete placement and labels, More/slash density, unavailable/one-column state clarity, header/body selected-cell focus continuity, undo/redo feel, row-operation and final-cell Tab compatibility, nested table reachability, wide-table horizontal scrolling, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap at constrained width, the intentionally far-right-scrolled wide-table composition, and constrained layout.
- MME-0074 table reorder review: implementation accepted for code continuation; review row-up/down and column-left/right placement and labels, More/slash density, first/last boundary clarity, moved-cell focus continuity, undo/redo feel, interaction with insert/delete and final-cell Tab, nested table reachability, wide-table horizontal scrolling, the observed dominant full-editor blue focus outline, the observed diagnostics-chip overlap at constrained width, the intentionally far-right-scrolled wide-table composition, and constrained layout.
- MME-0075 spreadsheet/TSV paste review: implementation accepted for code continuation; review paste discoverability, replacement/expansion behavior, final-cell focus feedback, literal punctuation display, undo/redo feel, nested table reachability, large-matrix and wide-table horizontal scrolling, the observed dominant full-editor focus outline, diagnostics-chip placement, intentionally far-right-scrolled wide-table composition, and constrained layout.
- MME-0077 todo semantics review: implementation accepted for code continuation; review unordered marker suppression, ordered numbering, checkbox alignment/density, checked styling, pointer/keyboard focus treatment, nested hierarchy, task creation/nesting/undo flow, Source visibility, and constrained layout.
- MME-0078 mobile viewport/touch review: review phone/tablet density, 44 px touch-target composition, safe-area spacing, coarse-pointer block-affordance visibility/taste, toolbar/menu reachability, reduced-height Source/Rich composition, and real browser/OS virtual-keyboard behavior.
- MME-0079 agent retrieval/content review: review final README/adoption/FAQ wording, product-profile taxonomy, direct-answer density, adopter-versus-end-user framing, comparison neutrality, generated adoption skill, and whether public copy is ready for launch.
- MME-0080 quoted-CSV paste review: review CSV paste discoverability, quoted/empty/literal cell presentation, replacement/expansion feedback, final-cell focus, undo/redo feel, constrained/wide-table reachability, and compatibility across real spreadsheet clipboard sources.
- Future visible/UI/HITL slices in this autonomous run should be added here instead of blocking code continuation, per the 2026-07-19 human instruction to review visible work in one final block.

- Visible asset upload UX and demo provider follow-up for image paste/drop, building on the promoted MME-0051 provider contract while keeping real storage host-owned. First visible upload UX slice promoted as `MME-0054`.
- LiteLLM / OpenAI-compatible AI provider adapter: provide an optional host-side adapter path for developers who want to let users choose among OpenAI, Gemini, Mistral, Anthropic, local models, or any LiteLLM-routed provider. This must stay outside MME core; production use should go through a host backend, sidecar, secure storage, or user-controlled gateway rather than exposing raw provider keys by default.
- CMS publishing bridge research: Decap CMS and TinaCMS can be considered as lightweight interim Git-backed content/admin bridges for agency/demo templates before MME is ready for that use case. Longer-term direction is MME-authored Markdown/blog/content flows publishing through Payload CMS, without weakening Markdown/YAML frontmatter as the source of truth or implying CMS persistence unless the adapter actually provides it.
- Payload CMS plugin/integration: future adapter/plugin that lets Payload-backed apps use MME as a Markdown-native content editor while preserving Markdown/YAML frontmatter truth, save/publish boundaries, permissions, draft/published state, and media handling explicitly.
- Collaboration positioning: public statement that CRDT/collaboration is future work; block-level targeted edit invariants must keep the door open.
- Optional settings UI components: headless settings state plus reference DOM components. Hosts still own final settings presentation.
- Link editing popover and docs-page link autocomplete, extending the public docs internal-link work.
- Migration guides from Tiptap, BlockNote, and plain textarea integrations.
- StackBlitz or equivalent example embeds for public docs.
- Agent-readable public docs and docs-site copy/open-in-chat affordances belong to public framework readiness, not demo-only polish.
- Reusable docs rendering post-processors: heading anchors, safe in-doc links, external-link decoration, and section metadata should move out of the docs-site shell once the pattern stabilizes, so hosts can reuse them without duplicating DOM rewriting logic.
- Reusable agent/docs action helpers: copy Markdown, copy section, copy prompt, and open-in-chat affordances should become framework-level docs/AI utilities or a small optional package, with host-owned UI chrome.
- Native docs content primitives: callouts, steps, tabbed code blocks, comparison tables, doc card grids, and overview/landing blocks should be expressible from Markdown or safe extensions, not hardcoded as docs-site-only React fragments.
- Docs navigation/search primitives: mobile navigation, on-page outline, and future command/search entry points should become optional framework patterns after the public docs site proves the IA shape.
- AX skills and manifests: create durable Codex/agent skills for MME docs usage, migration help, package selection, AI/privacy boundary checks, and docs-to-implementation prompts. These should be generated from the same public Markdown/`llms` sources rather than maintained as separate prose.
- Agent action registry for docs: model copy prompt, open in chat, section context, edit-on-GitHub, issue filing, and future "ask this page" as reusable AX descriptors that docs hosts can render in their own UI.
- BlockNote-class docs content map: use the 2026-07-08 BlockNote docs scrape as a benchmark taxonomy for future pages around AI, built-in blocks, schemas, UI components, import/export, collaboration, and editor setup. MME should cover analogous concepts honestly from Markdown-source-first principles, not copy BlockNote's block-database assumptions.
- Docs light/dark hardening: docs site now supports light and dark, but final public-release polish should audit every docs component, code block, live editor, screenshot, and framework token in both schemes before launch.
- MME-0038 explicit public-face validation debt: the docs site/AX surface may be committed and followed by later work per the 2026-07-16 human instruction, but it was not explicitly validated as final. The active final-review item is tracked in the end-of-run human review queue above.
- MME-0025 unreviewed detail: audit whether CSS-only compatibility tokens carried from MME-0039 (`border-strong`, accent hover/soft variants, warning/code/preview/topbar/overlay/content-measure) should remain CSS-only, become typed `MmeTheme` keys, or collapse into the strict public token set during MME-0030/public-release hardening. The human accepted the MME-0025 direction but did not explicitly review each compatibility token.
- MME-0025 unreviewed detail: audit every default icon glyph, icon-only label, toolbar density, and light/dark accessibility state before public release. The human accepted the toolbar icon direction but did not explicitly review each icon asset as final.

## Non-Text Contrast Of Interactive Boundaries (WCAG 1.4.11)

Tags: `baseline/hygiene`, `accessibility`, `design-system`

- Recorded first in the MME-0102 review (interactive borders at 1.2–1.5:1) and re-measured
  independently by the MME-0086 accessibility review: text-input boundaries compute to
  **1.277:1 in light** (`--mme-color-border` `#dfe4ec` on `--mme-color-surface-raised` `#ffffff`)
  and **1.270:1 in dark** (`#2b2f38` on `#1a1c22`), against WCAG 1.4.11's 3:1 requirement.
  Affects the command palette, find/replace, and the MME-0086 code language/meta fields.
- Not fixable by nudging one ramp step: no neutral below `--mme-neutral-10` (`#78849a`, 3.77:1
  on white) reaches 3:1. Either the border alias for control boundaries points at neutral-10,
  or the ramp's 6–8 band is revisited.
- `tests/theme-contrast.test.mjs` checks **text** pairs only and is structurally blind to
  boundary contrast — the same shape of gap as the opacity-based disabled state found in the
  Block B3 review. Any issue promoted from this entry must extend that gate, not just the tokens.
- Text contrast itself is healthy and was verified during MME-0086: muted label on raised
  surface measures 7.56:1 in both schemes.

## Advanced Editor Preferences

Tags: `maybe-later`, `settings`, `power-user`

- Vim mode hook.
- Typewriter mode.
- Focus mode.
- Word/character stats surface.
- Host-configurable keyboard shortcut profile.

## Performance And Scale

Tags: `baseline/hygiene`, `performance`, `public-release`

- Define performance budgets before public framework release.
- Add large-document benchmarks, including 10k-line documents.
- Prove incremental parse/serialize behavior where expected.
- Debounce expensive status checks without making save truth stale.

## Promotion Candidates

These are names for future split candidates, not accepted issue IDs.

Promoted 2026-07-19 into normal `docs/internal/ISSUES.md` entries:

- `MME-0040 — Tables preservation and rendering`.
- `MME-0041 — Footnotes and endnotes`.
- `MME-0042 — Core editor interaction hardening`.
- `MME-0043 — Live Preview parity foundation`.
- `MME-0044 — Unified Open, New File, Save As, and status chrome`.
- `MME-0045 — Toolbar, slash, and mode controls final UX`.
- `MME-0046 — HTML preview reading polish`.
- `MME-0047 — Folding and document structure polish`.
- `MME-0048 — Public docs launch hardening and MME-0038 validation debt`.
- `MME-0049 — AX skills, manifests, and reusable agent actions`.
- `MME-0050 — Performance budgets and large-document benchmarks`.
- `MME-0051 — Asset upload provider contract and image paste/drop preservation`.
- `MME-0052 — Plain text and lightweight source file support`.
- `MME-0053 — SVG source reader and sanitized preview`.
- `MME-0054 — Visible asset upload UX and demo provider`.
- `MME-0055 — Rich GFM table editing baseline`.
- `MME-0056 — Rich GFM footnote definition editing baseline`.
- `MME-0057 — Rich GFM footnote insertion baseline`.
- `MME-0058 — Rich GFM footnote identifier rename baseline`.
- `MME-0059 — Rich multiline GFM footnote definition editing baseline`.
- `MME-0060 — Rich multi-paragraph GFM footnote definition editing baseline`.
- `MME-0061 — Rich list-block GFM footnote definition editing baseline`.
- `MME-0062 — Rich nested-list GFM footnote definition editing baseline`.
- `MME-0063 — Rich task-list GFM footnote definition editing baseline`.
- `MME-0064 — Rich loose-list-item GFM footnote definition editing baseline`.
- `MME-0065 — Rich blockquote GFM footnote definition editing baseline`.
- `MME-0066 — Rich fenced-code GFM footnote definition editing baseline`.
- `MME-0067 — Rich indented-code GFM footnote definition editing baseline`.
- `MME-0068 — Rich table GFM footnote definition editing baseline`.
- `MME-0069 — Rich Obsidian callout footnote definition editing baseline`.
- `MME-0070 — Rich inert raw-HTML footnote block editing baseline`.
- `MME-0071 — Rich inert inline-HTML footnote paragraph editing baseline`.
- `MME-0072 — Rich Markdown table row operations baseline`.
- `MME-0073 — Rich Markdown table column operations baseline`.
- `MME-0074 — Rich Markdown table row and column reorder baseline`.
- `MME-0075 — Rich table spreadsheet/TSV paste baseline`.
- `MME-0076 — Agent-indexable repository and docs discovery`.
- `MME-0077 — Rich todo semantic DOM and accessibility integrity`.
- `MME-0078 — Mobile viewport and touch reachability baseline`.
- `MME-0079 — Agent retrieval and adoption-content hardening`.
- `MME-0080 — Rich table quoted-CSV clipboard paste baseline`.

- Editor live preview parity.
- Toolbar/slash/menu final UX.
- Unified Open flow and file-type routing.
- New file / Save As flow with truthful writable-vs-export behavior.
- HTML preview reading polish.
- Office/PDF/Google Docs adapter research.
- Payload CMS plugin/integration.
- Document status/save truth UI.
- Footnotes/endnotes preservation, rendering, backlink navigation, and editing UX.
- First rich footnote definition editing baseline promoted as `MME-0056`; insertion is promoted as `MME-0057`; identifier rename is promoted as `MME-0058`; top-level continuation-line editing is promoted as `MME-0059`; top-level multi-paragraph editing is promoted as `MME-0060`; standard list-block editing is promoted as `MME-0061`; nested standard lists are promoted as `MME-0062`; task lists are promoted as `MME-0063`; loose/list-spread and multi-paragraph list items are promoted as `MME-0064`; safe paragraph-only blockquotes are promoted as `MME-0065`; safe fenced code blocks are promoted as `MME-0066`; safe indented code blocks are promoted as `MME-0067`; safe table blocks are promoted as `MME-0068`; safe paragraph-only Obsidian callouts are promoted as `MME-0069`; inert block-HTML source editing is promoted as `MME-0070`; inert inline-HTML paragraph source editing is promoted as `MME-0071`; other arbitrary nested blocks remain future splits.
- Table rendering and first rich table editing baseline promoted as `MME-0040` and `MME-0055`; explicit body-row operations are implemented as `MME-0072`; explicit column operations are implemented as `MME-0073`; row/column reorder is implemented as `MME-0074`; strict spreadsheet/TSV clipboard paste is implemented as `MME-0075`; quoted CSV clipboard paste is promoted as `MME-0080`; HTML-table paste remains backlog.
- Nested GFM table rich editing requires container-specific bounded serialization. MME-0068 covers the safe footnote-definition and standard/task-list subset; blockquote-contained and other generic nested tables remain source-only instead of rewriting container syntax.
- Inline slash AI prompt surface.
- LiteLLM / OpenAI-compatible AI provider adapter.
- Dedicated issue promoted: `MME-0028.5 — Inline AI prompt surface and usable writing flow`.
- Dedicated issue promoted: `MME-0028.6 — Real AI provider adapter path`.
- First mobile/tablet viewport and touch-reachability baseline implemented in `MME-0078`; full mobile editor, native shell, platform keyboard, and gesture work remains backlog.
- Performance budgets and large-document benchmarks.

## Promotion Rules

- Promote to `PRD.md` when the item defines durable product vision.
- Promote to `QUALITY_GATES.md` when it becomes a non-negotiable invariant.
- Promote to `ISSUES.md` only when it can be implemented as a slice with scope, acceptance criteria, tests/manual checks, visual impact, and reviewer plan.
- Keep `.learnings/FEATURE_REQUESTS.md` as the session-level capture log; this backlog is the product-level parking lot.
