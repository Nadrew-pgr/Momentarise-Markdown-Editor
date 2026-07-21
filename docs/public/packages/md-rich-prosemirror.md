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
updated: 2026-07-21
---

# ProseMirror Rich View

`@momentarise/md-rich-prosemirror` is the first rich-mode bridge for MME.

## Use It For

- Markdown-to-rich state creation;
- rich serialization back to Markdown;
- input rules;
- list and todo editing;
- standard GFM table editing and cell navigation;
- GFM footnote definition editing, including safe continuation lines;
- collision-safe GFM footnote insertion;
- exact identifier rename across one definition and its references;
- folding;
- block affordance helpers;
- source-to-rich and rich-to-source selection mapping for host commands.

## Boundary

Rich mode is a derived view. It must not make ProseMirror JSON the durable source.

## Table Editing

Safely representable rectangular top-level GFM pipe tables mount as rich table nodes. Cell edits serialize back to valid GFM Markdown, while untouched tables keep their original bytes and unrelated source ranges are not rewritten.

Hosts can use `selectRichTableCell`, `moveRichTableCell`, `richTableCellCoordinates`, and `replaceRichTableCellText` for coordinate-based table actions. Tab and Shift+Tab use the same reusable movement behavior; Tab from the final cell adds one rectangular Markdown-representable row.

Nested, malformed, non-standard, or non-representable table-like syntax stays in the preserved source-only fallback until MME can rewrite that exact nested range without touching container syntax.

## Footnote Editing

Unique top-level GFM definitions with representable inline content mount as semantic editable blocks. Supported definitions can be single-line or one paragraph continued across consistently indented source lines. Their references remain semantic inline nodes and retain their original Markdown spelling.

Hosts can use `selectRichFootnoteDefinition` to select an existing body by identifier, `replaceRichFootnoteDefinitionText` to replace it with single-line text, `insertRichFootnote` to insert one reference plus its matching definition in a single history action, and `renameRichFootnoteIdentifier` to rename one definition plus every matching semantic reference. Changed, inserted, and renamed definitions serialize through exact source mappings; unrelated Markdown and line endings remain untouched.

Insertion allocates collision-safe identifiers, accepts an explicit unused identifier, and refuses non-collapsed or unsupported selections, non-representable bodies, and stale source mappings. Rename refuses collisions, duplicates, unsafe identifiers, partially mapped references, and stale source mappings without mutating the document. Multi-paragraph, nested, duplicate, malformed, unsafe, inconsistently indented, or otherwise non-representable definitions stay in the visible source-only fallback.

## Related Docs

- [Preservation](../concepts/preservation.md)
- [Document Model](../concepts/document-model.md)
