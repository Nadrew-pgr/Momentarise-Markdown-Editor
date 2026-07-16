---
title: Import, Export, And Rendering
description: Markdown stays source; HTML and external formats are explicit artifacts or adapters.
nav_section: Features
nav_order: 7
audience: developers
tags:
  - import
  - export
  - html
llms: include
updated: 2026-07-08
---

# Import, Export, And Rendering

MME separates durable source from artifacts.

Markdown files are the source. HTML, previews, print output, docs pages, and future office-format conversions are derived unless a host adapter explicitly proves round-trip persistence.

## Markdown In And Out

MME can open Markdown, parse it into framework nodes, preserve unsupported syntax as raw or opaque content, and serialize safely back to Markdown.

That is the default import/export path: a real `.md` file remains a real `.md` file.

## HTML Rendering

`@momentarise/md-render-html` renders Markdown into sanitized HTML for read-only surfaces such as docs, previews, and static output.

Raw HTML inside Markdown can render where policy allows, but HTML is not silently promoted to the durable document format.

## Standalone HTML Preview

Standalone `.html` files use the sandbox preview path. They are treated as HTML artifacts, not Markdown documents.

Scripts are disabled by default and sandbox permissions must stay explicit.

## Future Format Adapters

DOCX, PDF, Google Docs, and similar formats need explicit adapter semantics before MME can claim support. Each adapter must say whether it is preview-only, import-to-Markdown, export-from-Markdown, or true round-trip editing.

## Related Docs

- [Preservation](preservation.md)
- [HTML Renderer](../packages/md-render-html.md)
- [HTML Artifact Preview](../packages/md-preview-html.md)
- [Roadmap](../roadmap.md)
