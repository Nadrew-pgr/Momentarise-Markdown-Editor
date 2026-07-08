---
title: "Package: md-adapter-theia"
description: Alpha Theia shell adapter.
nav_section: Packages
nav_order: 15
audience: developers
tags:
  - package
  - theia
packages:
  - "@momentarise/md-adapter-theia"
llms: include
updated: 2026-07-08
---

# Package: md-adapter-theia

`@momentarise/md-adapter-theia` proves MME can run inside an IDE-like host without moving core logic into the adapter.

## Use It For

- Theia widget registration;
- Markdown OpenHandler integration;
- FileService-backed save targets;
- host keybinding delegation;
- preference bridging;
- find command routing.

## Boundary

Theia owns shell services. MME owns parsing, session state, save truth, source editing, and surface composition.

## Related Docs

- [Save Truthfulness](../concepts/save-truthfulness.md)
- [Package Reference: md-editor](md-editor.md)
