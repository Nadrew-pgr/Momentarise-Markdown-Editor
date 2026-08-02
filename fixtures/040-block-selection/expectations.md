# 040-block-selection expectations

Added for MME-0103 (block selection model). Two documents:

- `input.md` — LF, with frontmatter, multi-blank-line gaps, and one instance of
  every framed block type the block layer must treat as a whole object: table,
  fenced code, callout, raw HTML, unknown/opaque syntax, media image, plus a
  footnote definition as a top-level block.
- `input-crlf.md` — the same shape with CRLF line endings throughout. Its bytes
  are the point of the fixture; `.gitattributes` marks it `-text` so no
  checkout, editor, or tool normalizes it into LF.

## Preservation

- Both documents must round-trip byte-for-byte through rich mode untouched.
- Deleting, duplicating, replacing, or moving one block must leave every other
  block byte-identical, **including the separator bytes between the survivors**.
  A CRLF document must never gain a bare LF; a four-newline gap must never
  collapse to two. The gap a writer authored after a surviving block is that
  block's own content.
- Deleting the last block must keep the document's trailing bytes, not
  substitute a bare `\n`.

## Normalized

- Nothing in these documents is normalized while it is untouched.
- A block that the user replaces or duplicates is reconstructed from the rich
  model, so a *copy* may differ from its original in list-marker or emphasis
  style. The original and every other block stay byte-exact; the reconstruction
  is confined to the block the user acted on.

## Opaque

- The callout, the raw HTML block, and the `::: unknown-directive` block are
  carried as opaque nodes holding their raw source. Selecting or deleting them
  as blocks must move that raw source around intact and must never flatten one
  into an approximate paragraph.

## Source-only

- YAML frontmatter is held as source and never enters the rich document, so no
  block selection can ever reach it. Deleting the first body block must keep the
  frontmatter and the blank line after it exactly as authored.

## Render

- Every block renders as its own top-level element in rich mode, which is what
  makes each one individually selectable as an object. The table renders through
  `prosemirror-tables`, whose cell selection must not be allowed to reinterpret a
  table block selection.
- The media line (`![Diagram](./diagram.png)`) is a **paragraph containing an
  inline image**, not a dedicated media node: the rich schema has no top-level
  media block today. It is included so the block layer is proven against the
  image-only paragraph a writer actually produces, and the framed-block matrix
  names it as a `paragraph` rather than implying a node type that does not exist.

## Policy

- Both documents are synthetic and contain no credentials, personal data, or
  sensitive content.
