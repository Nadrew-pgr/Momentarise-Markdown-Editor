---
title: HTML Artifact Preview
description: Sandboxed preview descriptors for standalone HTML files.
nav_section: Features
nav_order: 13
audience: developers
tags:
  - package
  - html
packages:
  - "@momentarise/md-preview-html"
llms: include
updated: 2026-07-08
---

# HTML Artifact Preview

`@momentarise/md-preview-html` handles standalone HTML artifact preview descriptors.

## Use It For

- sandboxed iframe preview defaults;
- script-disabled HTML artifact reading;
- host policy around HTML compatibility tokens.

## Boundary

Standalone `.html` artifacts are not Markdown documents. Markdown inline or block HTML is rendered by [md-render-html](md-render-html.md).

## Related Docs

- [Document Model](../concepts/document-model.md)
- [HTML Renderer](md-render-html.md)
