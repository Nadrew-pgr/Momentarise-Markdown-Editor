---
title: Web File Access
description: Browser file-open and save-target helpers.
nav_section: Reference
nav_order: 14
audience: developers
tags:
  - package
  - web
packages:
  - "@momentarise/md-adapter-web"
llms: include
updated: 2026-07-19
---

# Web File Access

`@momentarise/md-adapter-web` keeps browser file capabilities at the host boundary.

## Use It For

- File System Access save targets;
- imported-copy and download-required targets;
- Markdown and lightweight source-file open/save routing;
- external content reads;
- focus and visibility refresh watchers.

## Source File Routing

The adapter opens Markdown plus lightweight source text files through the same save-target contracts. A `.log`, `.txt`, `.json`, `.yaml`, or `.toml` file can be writable when the browser grants a File System Access handle.

Lightweight source files stay source-only. The adapter reports their document kind so hosts can hide Markdown-only Rich, Live Preview, parser, and serializer claims.

Unsupported file names return an unsupported document result instead of being mislabeled as Markdown.

## External Change Strategy

The web adapter should combine focus or visibility refresh with save-time hash verification. Clean sessions may apply external content. Dirty sessions must enter conflict instead of overwriting local edits.

## Related Docs

- [Save Truthfulness](../concepts/save-truthfulness.md)
- [Vanilla Quickstart](../quickstart/vanilla.md)
