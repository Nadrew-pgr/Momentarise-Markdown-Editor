---
title: "Package: md-adapter-web"
description: Web host capability helpers.
nav_section: Packages
nav_order: 14
audience: developers
tags:
  - package
  - web
packages:
  - "@momentarise/md-adapter-web"
llms: include
updated: 2026-07-08
---

# Package: md-adapter-web

`@momentarise/md-adapter-web` keeps browser file capabilities at the host boundary.

## Use It For

- File System Access save targets;
- imported-copy and download-required targets;
- external content reads;
- focus and visibility refresh watchers.

## External Change Strategy

The web adapter should combine focus or visibility refresh with save-time hash verification. Clean sessions may apply external content. Dirty sessions must enter conflict instead of overwriting local edits.

## Related Docs

- [Save Truthfulness](../concepts/save-truthfulness.md)
- [Vanilla Quickstart](../quickstart/vanilla.md)
