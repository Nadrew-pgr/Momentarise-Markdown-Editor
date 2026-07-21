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
- Future rich editing should support cells, rows, columns, keyboard navigation, paste from spreadsheet/CSV-like content, and explicit Markdown-safe serialization.
- Tests must include real table fixtures, edited-neighbor preservation, and round-trip proof.

### Footnotes / Endnotes

Tags: `baseline/hygiene`, `markdown`, `navigation`, `round-trip`

- Preserve GFM-style `[^ref]` references and definitions.
- Render footnotes/endnotes in read mode and live preview.
- Support backlink navigation in rendered views.
- Keep source mode fallback for editing unusual footnote syntax.
- Future rich editing should include insertion and edit affordances without hiding the Markdown source model.
- First rich editing slice for existing simple definitions promoted as `MME-0056`; new footnote insertion is promoted as `MME-0057`; identifier rename is promoted as `MME-0058`; top-level continuation-line editing is promoted as `MME-0059`; top-level multi-paragraph editing is promoted as `MME-0060`; standard list-block editing is promoted as `MME-0061`; nested standard list editing is promoted as `MME-0062`; task-list editing is promoted as `MME-0063`; loose/list-spread and multi-paragraph list items are promoted as `MME-0064`; safe paragraph-only blockquotes are promoted as `MME-0065`; safe fenced code blocks are promoted as `MME-0066`; safe indented code blocks are promoted as `MME-0067`; safe table blocks are promoted as `MME-0068`; safe paragraph-only Obsidian callouts are promoted as `MME-0069`; inert block-HTML source editing is promoted as `MME-0070`; inline HTML and other arbitrary nested blocks remain backlog.
- Tests must include real footnote fixtures and parser/source/rich round-trip proof before claiming coverage.

### Core Markdown Blocks

Tags: `baseline/hygiene`, `markdown`, `editing`

- H1-H6 headings, paragraphs, thematic breaks, blockquotes, code fences, inline code, links, images, ordered lists, unordered lists, nested lists, task lists, frontmatter, raw HTML, Mermaid, LaTeX, wikilinks, callouts, and unknown syntax must preserve safely.
- Unsupported syntax should become raw/opaque where needed, not corrupted editable content.
- Live preview should update common Markdown constructs without requiring a source/rich mode bounce.
- Raw inline and block HTML inside Markdown should eventually render where policy allows while preserving source bytes. This is distinct from opening a standalone `.html` artifact.
- Callouts, opaque blocks, inserted media, and document-end content need explicit editing affordances so users are not trapped inside or below framed blocks.

### Core Editor Interactions

Tags: `baseline/hygiene`, `editing`, `mobile`, `desktop`

- Undo/redo, selection, copy/paste, Enter, Backspace, Tab/Shift+Tab indentation, drag/drop where applicable, keyboard shortcuts, and document-end insertion must be reliable.
- Lists and todos must continue, indent, outdent, split, and exit predictably.
- Source, Rich, and Live Preview editing ergonomics must be consistent enough that users do not feel like they are switching between unrelated products.
- Enter, Backspace, paste, selection, and undo/redo must remain predictable around headings, lists, todos, quotes, code blocks, callouts, opaque blocks, inserted media, and document end.
- Indentation/outdent with Tab/Shift+Tab must work across nested bullet lists, ordered lists, and todos.
- Audit the shared `todo_item` DOM semantics for both standalone task blocks and task items inside bullet/ordered lists before 1.0; keep native button focus/state behavior while ensuring valid list and assistive-technology structure.
- Block insertion affordances are needed before and after framed blocks, opaque blocks, code blocks, and at the end of the document.
- Clicking in the empty space below the final block should create/focus a paragraph after that block, especially after code fences, opaque extension blocks, callouts, and inserted media. This should be handled as part of the block-affordance pass rather than as a demo-only hack.
- Mobile/tablet must not be an afterthought: touch selection, virtual keyboard behavior, viewport sizing, and toolbar reachability need a dedicated pass.

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

## Public Framework Follow-Ups

Tags: `public-release`, `dx`, `ax`, `research`

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
- MME-0070 raw-HTML-footnote review: review code-like source readability, top-level/list/task hierarchy, literal-versus-preview clarity, script/event-handler inertness messaging, edit/focus flow, horizontal scrolling, inline/overlapping/nested/mixed fallback wording, Source visibility, and constrained layout.
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

- Editor live preview parity.
- Toolbar/slash/menu final UX.
- Unified Open flow and file-type routing.
- New file / Save As flow with truthful writable-vs-export behavior.
- HTML preview reading polish.
- Office/PDF/Google Docs adapter research.
- Payload CMS plugin/integration.
- Document status/save truth UI.
- Footnotes/endnotes preservation, rendering, backlink navigation, and editing UX.
- First rich footnote definition editing baseline promoted as `MME-0056`; insertion is promoted as `MME-0057`; identifier rename is promoted as `MME-0058`; top-level continuation-line editing is promoted as `MME-0059`; top-level multi-paragraph editing is promoted as `MME-0060`; standard list-block editing is promoted as `MME-0061`; nested standard lists are promoted as `MME-0062`; task lists are promoted as `MME-0063`; loose/list-spread and multi-paragraph list items are promoted as `MME-0064`; safe paragraph-only blockquotes are promoted as `MME-0065`; safe fenced code blocks are promoted as `MME-0066`; safe indented code blocks are promoted as `MME-0067`; safe table blocks are promoted as `MME-0068`; safe paragraph-only Obsidian callouts are promoted as `MME-0069`; inert block-HTML source editing is promoted as `MME-0070`; inline HTML and other arbitrary nested blocks remain future splits.
- Table rendering and first rich table editing baseline promoted as `MME-0040` and `MME-0055`; advanced spreadsheet-like table UX remains backlog.
- Nested GFM table rich editing requires container-specific bounded serialization. MME-0068 covers the safe footnote-definition and standard/task-list subset; blockquote-contained and other generic nested tables remain source-only instead of rewriting container syntax.
- Inline slash AI prompt surface.
- LiteLLM / OpenAI-compatible AI provider adapter.
- Dedicated issue promoted: `MME-0028.5 — Inline AI prompt surface and usable writing flow`.
- Dedicated issue promoted: `MME-0028.6 — Real AI provider adapter path`.
- Mobile/tablet input and layout pass.
- Performance budgets and large-document benchmarks.

## Promotion Rules

- Promote to `PRD.md` when the item defines durable product vision.
- Promote to `QUALITY_GATES.md` when it becomes a non-negotiable invariant.
- Promote to `ISSUES.md` only when it can be implemented as a slice with scope, acceptance criteria, tests/manual checks, visual impact, and reviewer plan.
- Keep `.learnings/FEATURE_REQUESTS.md` as the session-level capture log; this backlog is the product-level parking lot.
