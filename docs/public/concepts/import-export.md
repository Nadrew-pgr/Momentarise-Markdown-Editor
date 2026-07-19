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
  - svg
  - source
llms: include
updated: 2026-07-19
---

# Import, Export, And Rendering

MME separates durable source from artifacts.

Markdown files are the source. HTML, previews, print output, docs pages, and future office-format conversions are derived unless a host adapter explicitly proves round-trip persistence.

## Markdown In And Out

MME can open Markdown, parse it into framework nodes, preserve unsupported syntax as raw or opaque content, and serialize safely back to Markdown.

That is the default import/export path: a real `.md` file remains a real `.md` file.

## Lightweight Source Files

MME can also open adjacent source-like text files such as `.txt`, `.text`, `.log`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, and `.toml`.

Those files are source-only documents. They use the same truthful save and external-change contracts, but MME does not parse them as Markdown, does not expose Rich or Live Preview, and does not claim semantic validation or formatting.

## HTML Rendering

`@momentarise/md-render-html` renders Markdown into sanitized HTML for read-only surfaces such as docs, previews, and static output.

Raw HTML inside Markdown can render where policy allows, but HTML is not silently promoted to the durable document format.

## Standalone HTML Preview

Standalone `.html` files use the sandbox preview path. They are treated as HTML artifacts, not Markdown documents.

Scripts are disabled by default and sandbox permissions must stay explicit.

## Standalone SVG Preview

Standalone `.svg` files are visual source artifacts. MME opens the source for editing and exposes a conservative sanitized Preview path.

The V0 sanitizer keeps simple SVG drawing elements and strips unsupported or active preview content such as scripts, `on*` event handlers, script/data URL protocols, external references, `foreignObject`, remote CSS, image references, and unknown elements before rendering. The sanitized preview is derived only; Save and Save As write the original SVG source text, not the preview artifact.

SVG artifacts expose Source and Preview. They do not expose Markdown parsing, Rich mode, or Live Preview.

## Future Format Adapters

DOCX, PDF, Google Docs, and similar formats need explicit adapter semantics before MME can claim support. Each adapter must say whether it is preview-only, import-to-Markdown, export-from-Markdown, or true round-trip editing.

## Related Docs

- [Preservation](preservation.md)
- [HTML Renderer](../packages/md-render-html.md)
- [HTML Artifact Preview](../packages/md-preview-html.md)
- [Roadmap](../roadmap.md)
