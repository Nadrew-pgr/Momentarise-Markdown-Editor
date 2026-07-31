---
title: React Quickstart
description: Mount the thin React binding for Momentarise Markdown Editor.
nav_section: Getting Started
nav_order: 2
audience: developers
tags:
  - react
  - quickstart
packages:
  - "@momentarise/md-react"
  - "@momentarise/md-save"
llms: include
updated: 2026-07-28
---

# React Quickstart

The React binding is lifecycle glue. It does not make MME React-only, and it does not move Markdown state into React.

## Install

The packages are experimental and published to npm under the `alpha` dist-tag (`0.1.0-alpha.1`), not `latest`.

```bash
npm install @momentarise/md-react@alpha @momentarise/md-save@alpha react react-dom
```

`@momentarise/md-react` declares a peer dependency range of `react: "^18 || ^19"`. Packages are ESM-only (`"type": "module"`, no CommonJS build); import with `import`, not `require`. See [Compatibility Promise](../compatibility-promise.md).

## Mount The Editor

```tsx
import { MarkdownEditor } from "@momentarise/md-react";
import { createMemorySaveTarget } from "@momentarise/md-save";

const content = "# React host\n\nMarkdown remains source.\n";

export function EditorPanel() {
  return (
    <MarkdownEditor
      options={{
        content,
        scheduler: {
          schedule(callback, delayMs) {
            const id = window.setTimeout(() => void callback(), delayMs);
            return () => window.clearTimeout(id);
          }
        },
        target: createMemorySaveTarget({ initialContent: content })
      }}
    />
  );
}
```

## What React Owns

React owns component lifecycle and container mounting.

MME owns:

- canonical Markdown content;
- parsing and serialization;
- save state;
- policy decisions;
- extension registry;
- source and rich view coordination.

## Working Example

`examples/next-app/` in the repository is a complete, registry-installed working project built on this binding, with React 19 and StrictMode on.

## Related Docs

- [Next.js Quickstart](next.md)
- [Document Model](../concepts/document-model.md)
- [React Binding API](../packages/md-react.md)
