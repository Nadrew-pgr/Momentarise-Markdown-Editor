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
updated: 2026-07-08
---

# ProseMirror Rich View

`@momentarise/md-rich-prosemirror` is the first rich-mode bridge for MME.

## Use It For

- Markdown-to-rich state creation;
- rich serialization back to Markdown;
- input rules;
- list and todo editing;
- folding;
- block affordance helpers.

## Boundary

Rich mode is a derived view. It must not make ProseMirror JSON the durable source.

## Related Docs

- [Preservation](../concepts/preservation.md)
- [Document Model](../concepts/document-model.md)
