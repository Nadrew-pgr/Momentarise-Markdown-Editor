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

Standard rectangular top-level GFM pipe tables mount as editable ProseMirror table nodes. Nested, malformed, or non-representable table-like syntax remains an opaque source-only block until its source range can be rewritten without touching container syntax.

## Rich footnote helpers

- `selectRichFootnoteDefinition` selects the body of one supported existing definition by identifier.
- `replaceRichFootnoteDefinitionText` replaces that definition body with Markdown-representable single-line text.
- `insertRichFootnote` inserts one semantic reference plus a collision-safe, single-line definition in one history action.
- `renameRichFootnoteIdentifier` renames one unique editable definition and every matching semantic reference in one history action, or returns a non-mutating reason when any source token cannot be mapped safely.

Unique top-level GFM definitions with representable inline content mount as editable semantic blocks. This includes single-line definitions, single paragraphs continued on consistently indented source lines, and multiple plain paragraphs separated by valid indented blank-line structure. Unchanged paragraph source stays byte-exact when a sibling paragraph is edited. References remain semantic inline atoms and retain their original Markdown spelling. New and renamed references and definitions use exact source mapping, preserve unrelated Markdown bytes and line endings, and refuse unsupported, ambiguous, colliding, partially mapped, or stale operations. Nested-block, nested-container, duplicate, malformed, unsafe, inconsistently indented, or otherwise non-representable definitions remain visible source-only fallbacks.

## Release metadata

- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: MPL-2.0
- Public API: root package exports are audited by `npm run test:public-api`.
