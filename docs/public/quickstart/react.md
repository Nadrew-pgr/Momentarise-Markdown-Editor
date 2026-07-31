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

The packages are experimental and published to npm under the `alpha` dist-tag (`0.1.0-alpha.3`), not `latest`.

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

## Editing Modes

The binding mounts a real editing surface for every mode its mode control offers: **Source** (CodeMirror) and **Rich** (ProseMirror). Switching modes swaps the surface while the session keeps canonical Markdown; untouched documents round-trip byte-for-byte.

The rich view is dynamically imported the first time a user enters rich mode, so consumers who stay in source never load the ProseMirror bundle. Rich mode therefore needs two optional peers installed — `@momentarise/md-rich-prosemirror` and `prosemirror-view`:

```bash
npm install @momentarise/md-rich-prosemirror@alpha prosemirror-view
```

If those peers are not installed, entering rich mode logs a clear error and the editor falls back to Source (which works fully) rather than showing a blank pane. **Live Preview is not offered by this binding** (it has no surface to mount), so no inert control appears.

## Working Example

`examples/next-app/` in the repository is a complete, registry-installed working project built on this binding, with React 19, StrictMode, and a working Source/Rich toggle.

## Related Docs

- [Next.js Quickstart](next.md)
- [Document Model](../concepts/document-model.md)
- [React Binding API](../packages/md-react.md)
