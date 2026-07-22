# @momentarise/md-rich-prosemirror

ProseMirror rich-mode bridge for Momentarise Markdown Editor.

## Interaction helpers

- `insertParagraphAfterCurrentBlock` / `canInsertParagraphAfterCurrentBlock` support explicit insertion after the selected rich block.
- `insertParagraphAfterFinalBlock` / `canInsertParagraphAfterFinalBlock` support host-owned document-end affordances after final framed blocks such as code fences, preserved raw blocks, tables, callouts, and image-only media placeholders.

## Rich table helpers

- `selectRichTableCell` selects a zero-based table, row, and column coordinate.
- `moveRichTableCell` applies the same next/previous movement used by the rich keymap, including one Markdown-safe row append from the final cell.
- `richTableCellCoordinates` reports the selected cell for host UI and tests.
- `replaceRichTableCellText` replaces one cell with Markdown-representable single-line text.
- `runRichTableRowOperation` inserts a body row before/after a selected or explicit target, or deletes a body row, with typed non-mutating failure reasons.
- `runRichTableColumnOperation` inserts a column before/after a selected or explicit target, or deletes a column, with typed non-mutating failure reasons.
- `runRichTableRowReorder` moves a validated body row between arbitrary indices while protecting the semantic header boundary.
- `runRichTableColumnReorder` moves a validated column between arbitrary indices while preserving its header, body cells, content, and alignment.
- `canRunRichMarkdownCommand` lets hosts disable context-sensitive row, column, and reorder commands before dispatching them.

Standard rectangular top-level GFM pipe tables mount as editable ProseMirror table nodes. The same helpers enumerate supported tables at any semantic document depth, including safe footnote-definition and standard/task-list children. Generic blockquote/container nesting, malformed tables, and non-representable table-like syntax remain opaque source-only blocks until their container has bounded serialization.

The `tableRowBefore`, `tableRowAfter`, and `tableRowDelete` registry commands reuse the same package-owned row-operation path. They admit semantic body rows only: the Markdown header row is protected, missing/stale/source-only targets do not mutate, inserted cells inherit header alignment, and selection moves into the inserted row or nearest surviving cell. Final-cell Tab append uses the same normalization path.

The `tableColumnBefore`, `tableColumnAfter`, and `tableColumnDelete` registry commands reuse the package-owned column-operation path. Inserted columns use semantic header/body cell types and neutral alignment, deletion protects the final remaining column, missing/stale/source-only targets do not mutate, and selection moves into the inserted or nearest surviving column on the target row.

The `tableRowUp`, `tableRowDown`, `tableColumnLeft`, and `tableColumnRight` registry commands reuse package-owned reorder paths. Row moves admit body rows only and never cross index `0`; column moves retain the corresponding header/body cells and alignment. Boundary, no-op, invalid, stale, missing, and source-only targets do not mutate. Selection follows the moved row or column at the same valid orthogonal coordinate. Drag handles, merged cells, resize, alignment controls, and spreadsheet paste are not part of this baseline.

## Rich footnote helpers

- `selectRichFootnoteDefinition` selects the body of one supported existing definition by identifier.
- `replaceRichFootnoteDefinitionText` replaces that definition body with Markdown-representable single-line text.
- `insertRichFootnote` inserts one semantic reference plus a collision-safe, single-line definition in one history action.
- `renameRichFootnoteIdentifier` renames one unique editable definition and every matching semantic reference in one history action, or returns a non-mutating reason when any source token cannot be mapped safely.

Unique top-level GFM definitions with representable inline content mount as editable semantic blocks. This includes exact single-line parser-owned inline-HTML tags/comments at unmarked paragraph depth, single-line definitions, single paragraphs continued on consistently indented source lines, multiple plain paragraphs separated by valid indented blank-line structure, paragraph-only blockquotes, safe paragraph-only Obsidian callouts, parser-recognized fenced or canonical space-indented code blocks, rectangular GFM pipe tables, one parser-owned closed raw-HTML block, and tight or loose bullet/ordered lists whose standard or task items begin with one representable paragraph and may contain additional safe paragraphs plus at most one recursively safe nested list, paragraph-only quote/callout, fenced/indented code block, table, or raw-HTML block. Task items reuse the package-owned accessible `todo_item` control and preserve checked state semantically. Safe callouts expose type, optional plain title, and optional `+`/`-` fold marker as package-owned attributes while keeping only body paragraphs editable; their semantic DOM header is non-editable and contains no exact source metadata. Inline HTML remains editable text under a serializer-neutral code-like mark, and block HTML remains literal editable text inside a dedicated code-like node; payload tags, attributes, scripts, styles, URLs, event handlers, and custom elements never become editor DOM or payload-derived wrapper attributes. Loose list/item spacing and block source syntax are package-owned state; exact source metadata remains outside rendered DOM. Unchanged child-block source stays byte-exact when a sibling block is edited. A changed paragraph, list, quote, callout, code block, table, or raw-HTML block is reconstructed deterministically inside its bounded definition range while retaining required separators, representable ordered-list start values, hierarchy, task state, callout metadata, code language/meta, inert text, table shape/alignment, and footnote container indentation. Changed fenced code uses a backtick or tilde fence long enough not to collide with body marker runs; changed indented code uses four spaces at its code-block layer while keeping blank lines blank; changed tables use valid deterministic GFM pipes and delimiters; changed raw HTML preserves the literal payload text while reapplying container indentation. References remain semantic inline atoms and retain their original Markdown spelling. New and renamed references and definitions use exact source mapping, preserve unrelated Markdown bytes and line endings, and refuse unsupported, ambiguous, colliding, partially mapped, or stale operations. Multiple container children per item, noncanonical or mixed-indent code, nested blockquotes/callouts, header-only or malformed callouts, callouts containing lists/block HTML, inline HTML nested under Markdown marks/links, multiline inline HTML, table-cell HTML, unclosed or multiple-root block HTML, quote-contained lists/code/tables/block HTML, malformed table-like paragraphs, other arbitrary item or quote children, nested-container definitions, duplicates, malformed definitions, inconsistent indentation, and otherwise non-representable definitions remain visible source-only fallbacks. Existing top-level opaque callouts/raw HTML and the raw callout command remain source-only in this baseline.

## Release metadata

- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: MPL-2.0
- Public API: root package exports are audited by `npm run test:public-api`.
