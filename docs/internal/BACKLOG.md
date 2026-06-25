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
- Block insertion affordances are needed before and after framed blocks, opaque blocks, code blocks, and at the end of the document.
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
- Plain text and adjacent source-like files: `.txt`, `.text`, `.log`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, `.toml`.
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

- Asset/upload provider contract for image paste and drag-drop, similar in spirit to BlockNote `uploadFile`, but adapted to MME's host-capability and SaveTarget contracts.
- LiteLLM / OpenAI-compatible AI provider adapter: provide an optional host-side adapter path for developers who want to let users choose among OpenAI, Gemini, Mistral, Anthropic, local models, or any LiteLLM-routed provider. This must stay outside MME core; production use should go through a host backend, sidecar, secure storage, or user-controlled gateway rather than exposing raw provider keys by default.
- CMS publishing bridge research: Decap CMS and TinaCMS can be considered as lightweight interim Git-backed content/admin bridges for agency/demo templates before MME is ready for that use case. Longer-term direction is MME-authored Markdown/blog/content flows publishing through Payload CMS, without weakening Markdown/YAML frontmatter as the source of truth or implying CMS persistence unless the adapter actually provides it.
- Payload CMS plugin/integration: future adapter/plugin that lets Payload-backed apps use MME as a Markdown-native content editor while preserving Markdown/YAML frontmatter truth, save/publish boundaries, permissions, draft/published state, and media handling explicitly.
- Collaboration positioning: public statement that CRDT/collaboration is future work; block-level targeted edit invariants must keep the door open.
- Optional settings UI components: headless settings state plus reference DOM components. Hosts still own final settings presentation.
- Link editing popover and docs-page link autocomplete, extending the public docs internal-link work.
- Migration guides from Tiptap, BlockNote, and plain textarea integrations.
- StackBlitz or equivalent example embeds for public docs.
- Agent-readable public docs and docs-site copy/open-in-chat affordances belong to public framework readiness, not demo-only polish.
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
- Footnotes/endnotes preservation, rendering, backlink navigation, and editing UX.
- Table rendering and rich table editing UX.
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
