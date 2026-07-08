---
title: "Package: md-core"
description: Host-independent core contracts for MME.
nav_section: Packages
nav_order: 1
audience: developers
tags:
  - package
packages:
  - "@momentarise/md-core"
llms: include
updated: 2026-07-08
---

# Package: md-core

`@momentarise/md-core` contains host-independent types and helpers shared across MME packages.

## Use It For

- document path and hash contracts;
- source ranges and positions;
- diagnostics;
- document and node model types;
- typed framework errors.

## Import

```ts
import { hashMarkdownContent, MomentariseError } from "@momentarise/md-core";

const hash = hashMarkdownContent("# Hello\n");
console.log(hash);
```

## Boundaries

This package must not depend on React, Theia, VS Code, CodeMirror, ProseMirror, Electron, or browser-only APIs.

## Related Docs

- [Document Model](../concepts/document-model.md)
- [Compatibility Promise](../compatibility-promise.md)
