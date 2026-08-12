---
title: ProseMirror Rich View
description: Rich-mode bridge that keeps Markdown serialization honest.
nav_section: Reference
nav_order: 11
audience: developers
tags:
  - package
  - prosemirror
packages:
  - "@momentarise/md-rich-prosemirror"
llms: include
updated: 2026-08-12
---

# ProseMirror Rich View

`@momentarise/md-rich-prosemirror` is the first rich-mode bridge for MME.

## Use It For

- Markdown-to-rich state creation;
- rich serialization back to Markdown;
- input rules;
- list and todo editing;
- standard GFM table editing and cell navigation;
- GFM footnote definition editing, including safe continuation lines and plain multi-paragraph bodies;
- collision-safe GFM footnote insertion;
- exact identifier rename across one definition and its references;
- folding;
- block affordance helpers;
- composition-safe serialization baselines for IME and dead-key input;
- source-to-rich and rich-to-source selection mapping for host commands;
- selection-context rules for formatting affordances.

## Boundary

Rich mode is a derived view. It must not make ProseMirror JSON the durable source.

## Formatting Context

`richSelectionSupportsFormatting(state)` answers whether a formatting affordance — a selection bubble, a shortcut, a host toolbar — may act on the current selection. It refuses an empty selection, any selection touching a code block, and any selection touching an opaque or unsupported block, whose bytes are preserved source rather than prose.

Hosts should call it instead of re-deriving the rule, so every surface refuses the same contexts. `strikethrough` is a `RichCommandId` alongside `bold`, `italic`, `inlineCode`, and `link`; it toggles the `strike` mark and serializes as `~~text~~`.

## Table Editing

Safely representable rectangular top-level GFM pipe tables mount as rich table nodes. Cell edits serialize back to valid GFM Markdown, while untouched tables keep their original bytes and unrelated source ranges are not rewritten.

Hosts can use `selectRichTableCell`, `moveRichTableCell`, `richTableCellCoordinates`, and `replaceRichTableCellText` for coordinate-based table actions. Tab and Shift+Tab use the same reusable movement behavior; Tab from the final cell adds one rectangular Markdown-representable row.

Nested, malformed, non-standard, or non-representable table-like syntax stays in the preserved source-only fallback until MME can rewrite that exact nested range without touching container syntax.

## Footnote Editing

Unique top-level GFM definitions with representable inline content mount as semantic editable blocks. Supported definitions can be single-line, one paragraph continued across consistently indented source lines, or multiple plain paragraphs separated by valid indented blank-line structure. Their references remain semantic inline nodes and retain their original Markdown spelling.

Hosts can use `selectRichFootnoteDefinition` to select an existing body by identifier, `replaceRichFootnoteDefinitionText` to replace it with single-line text, `insertRichFootnote` to insert one reference plus its matching definition in a single history action, and `renameRichFootnoteIdentifier` to rename one definition plus every matching semantic reference. Changed, inserted, and renamed definitions serialize through exact source mappings; unrelated Markdown and line endings remain untouched.

Insertion allocates collision-safe identifiers, accepts an explicit unused identifier, and refuses non-collapsed or unsupported selections, non-representable bodies, and stale source mappings. Rename refuses collisions, duplicates, unsafe identifiers, partially mapped references, and stale source mappings without mutating the document. Editing one supported paragraph preserves untouched sibling paragraph source exactly. Nested-block, nested-container, duplicate, malformed, unsafe, inconsistently indented, or otherwise non-representable definitions stay in the visible source-only fallback.

## Composition (IME And Dead Keys)

A composition is provisional until it ends. Every document the editor passes
through while an IME is active — each dead-key state, each candidate — is a state
the writer has not committed to, and a cancelled composition means none of them
happened.

Two consequences, both handled by the default plugin set:

- **A cancelled composition over a block selection restores the blocks.** The
  browser starts the composition over the selection's own DOM range, so
  cancelling it wipes that range. The block layer snapshots at
  `compositionstart` and re-asserts the snapshot once the composition has
  drained, inside the composition's own history event — so a following undo
  steps back past the whole non-event rather than replaying it.
- **No serialization baseline may be adopted while a composition is in flight.**

The second one is the host's to apply, because only the host knows where its
baseline lives. If your host re-derives Markdown from the rich view — anything
shaped like "on every document change, serialize and re-anchor" — gate it:

```ts
import { shouldAdoptRichSerializationBaseline } from "@momentarise/md-rich-prosemirror";

new EditorView(host, {
  state,
  dispatchTransaction(transaction) {
    const before = view.state.doc;
    const next = view.state.apply(transaction);
    view.updateState(next);

    const documentChanged = !next.doc.eq(before);
    if (shouldAdoptRichSerializationBaseline({ documentChanged, transaction, view })) {
      syncMarkdownFromRichView();
    }
  }
});
```

The predicate answers `true` for ordinary edits, `false` for anything dispatched
while a composition is in flight, and `true` once more when the composition has
drained — the package dispatches a release transaction for exactly that purpose.
So deferring cannot strand the composed text: the baseline is always adopted,
exactly once, on the settled document.

Hosts that also read the derived Markdown *outside* a transaction — a mode
switch, a find/replace, an AI request — need the same rule where no transaction
exists to consult. `isRichCompositionInFlight(view)` is that check:

```ts
import { isRichCompositionInFlight } from "@momentarise/md-rich-prosemirror";

function flushMarkdownFromRichView() {
  if (isRichCompositionInFlight(view)) {
    return; // the release re-anchors a frame later
  }
  syncMarkdownFromRichView();
}
```

Its window is wider than `view.composing` at both ends, which is the point:
ProseMirror dispatches a document change at `compositionstart` before it sets
that flag, and the browser keeps flushing DOM work after `compositionend`.
Reading the bytes from before the composition during that window is the honest
answer — they are what the writer has committed to.

Adopting a mid-composition document instead is not a cosmetic bug. The
restored document then serializes against a baseline that came from a state the
writer never typed, and the file gains blocks nobody wrote — bytes diverging
from a screen that looks correct.

## Related Docs

- [Preservation](../concepts/preservation.md)
- [Document Model](../concepts/document-model.md)
