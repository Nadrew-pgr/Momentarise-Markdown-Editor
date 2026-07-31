---
title: Vanilla Quickstart
description: Mount Momentarise Markdown Editor without a framework.
nav_section: Getting Started
nav_order: 1
audience: developers
tags:
  - vanilla
  - quickstart
packages:
  - "@momentarise/md-editor"
  - "@momentarise/md-source-codemirror"
  - "@momentarise/md-surface"
llms: include
updated: 2026-07-28
---

# Vanilla Quickstart

Use the vanilla path when your host is a browser app, Vite app, web component, IDE webview, or custom shell that does not want a React dependency.

## Install

The packages are experimental and published to npm under the `alpha` dist-tag (`0.1.0-alpha.3`), not `latest`.

```bash
npm install @momentarise/md-editor@alpha @momentarise/md-save@alpha @momentarise/md-source-codemirror@alpha @momentarise/md-surface@alpha
```

Packages are ESM-only (`"type": "module"`, no CommonJS build). Import with `import`, not `require`. See [Compatibility Promise](../compatibility-promise.md).

## Create A Session

```ts
import { createMarkdownEditorSession } from "@momentarise/md-editor";
import { createMemorySaveTarget } from "@momentarise/md-save";

const initialContent = "# Hello MME\n\nEdit real Markdown.\n";

const session = createMarkdownEditorSession({
  content: initialContent,
  scheduler: {
    schedule(callback, delayMs) {
      const id = window.setTimeout(() => void callback(), delayMs);
      return () => window.clearTimeout(id);
    }
  },
  target: createMemorySaveTarget({
    initialContent
  })
});
```

## Mount Views

Use `@momentarise/md-source-codemirror` for source editing and `@momentarise/md-surface` for framework-free toolbar, command, status, and assistant UI.

The session owns canonical Markdown. Views attach to it; hosts do not reimplement save state, policy, or extension orchestration.

## Save Behavior

A memory save target is useful for tests and demos. Real hosts should inject a target that writes to disk, browser File System Access, Theia file services, a backend, or another storage layer.

See [Save Truthfulness](../concepts/save-truthfulness.md) before wiring production persistence.

## Next Steps

- Use [Document Model](../concepts/document-model.md) to understand durable source.
- Use [Theming](../concepts/theming.md) to customize tokens and icons.
- Use [Extensions](../concepts/extensions.md) to register host commands.
