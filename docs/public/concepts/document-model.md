---
title: Document Model
description: Markdown is the durable source; views and artifacts are derived.
nav_section: Foundations
nav_order: 1
audience: developers
tags:
  - model
  - markdown
llms: include
updated: 2026-07-08
---

# Document Model

MME treats Markdown plus optional YAML frontmatter as the canonical persisted document.

Everything else is derived:

- CodeMirror source mode edits Markdown directly.
- ProseMirror rich mode is a structured view over Markdown.
- HTML rendering is an artifact for reading, printing, export, or docs.
- AI suggestions are staged changes against the current Markdown hash.
- Host adapters provide persistence and capabilities.

## Durable Source

Durable source means the user can keep, diff, back up, inspect, and edit the real `.md` file outside MME.

The framework can keep parsed ASTs, source maps, rich editor state, diagnostics, and sidecar UI state in memory. Those structures are valid only if they serialize safely back to Markdown.

## View Boundaries

Rich mode may represent supported Markdown as blocks and inline marks. Unsupported syntax must remain safe as raw or opaque content.

HTML is never the durable source for Markdown documents. A standalone `.html` file uses the HTML artifact preview path.

## Source Fallback

Source mode is mandatory. If a construct cannot be represented safely in rich mode, the user must still be able to inspect and edit the Markdown source.

## Related Docs

- [Preservation](preservation.md)
- [Save Truthfulness](save-truthfulness.md)
- [Core Contracts](../packages/md-core.md)
