---
title: "Package: md-rich-prosemirror"
description: ProseMirror rich-mode bridge for MME.
nav_section: Packages
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

# Package: md-rich-prosemirror

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
