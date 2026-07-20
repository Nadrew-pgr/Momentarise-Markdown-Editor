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
updated: 2026-07-20
---

# ProseMirror Rich View

`@momentarise/md-rich-prosemirror` is the first rich-mode bridge for MME.

## Use It For

- Markdown-to-rich state creation;
- rich serialization back to Markdown;
- input rules;
- list and todo editing;
- standard GFM table editing and cell navigation;
- folding;
- block affordance helpers;
- source-to-rich and rich-to-source selection mapping for host commands.

## Boundary

Rich mode is a derived view. It must not make ProseMirror JSON the durable source.

## Table Editing

Safely representable rectangular top-level GFM pipe tables mount as rich table nodes. Cell edits serialize back to valid GFM Markdown, while untouched tables keep their original bytes and unrelated source ranges are not rewritten.

Hosts can use `selectRichTableCell`, `moveRichTableCell`, `richTableCellCoordinates`, and `replaceRichTableCellText` for coordinate-based table actions. Tab and Shift+Tab use the same reusable movement behavior; Tab from the final cell adds one rectangular Markdown-representable row.

Nested, malformed, non-standard, or non-representable table-like syntax stays in the preserved source-only fallback until MME can rewrite that exact nested range without touching container syntax.

## Related Docs

- [Preservation](../concepts/preservation.md)
- [Document Model](../concepts/document-model.md)
