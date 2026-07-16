---
title: HTML Renderer
description: Sanitized Markdown-to-HTML rendering for read-only surfaces.
nav_section: Features
nav_order: 12
audience: developers
tags:
  - package
  - html
packages:
  - "@momentarise/md-render-html"
llms: include
updated: 2026-07-08
---

# HTML Renderer

`@momentarise/md-render-html` renders Markdown to sanitized HTML for read-only surfaces.

## Use It For

- docs site content rendering;
- read-only preview;
- print and export artifacts;
- server or static rendering.

## Import

```ts
import { renderMarkdownToHtml } from "@momentarise/md-render-html";

const result = renderMarkdownToHtml("# Hello\n");
console.log(result.html);
```

## Related Docs

- [HTML Artifact Preview](md-preview-html.md)
- [Document Model](../concepts/document-model.md)
