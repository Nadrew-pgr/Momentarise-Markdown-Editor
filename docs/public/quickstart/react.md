---
title: React Quickstart
description: Mount the thin React binding for Momentarise Markdown Editor.
nav_section: Quickstart
nav_order: 2
audience: developers
tags:
  - react
  - quickstart
packages:
  - "@momentarise/md-react"
  - "@momentarise/md-save"
llms: include
updated: 2026-07-08
---

# React Quickstart

The React binding is lifecycle glue. It does not make MME React-only, and it does not move Markdown state into React.

## Install

```bash
npm install @momentarise/md-react @momentarise/md-save react react-dom
```

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

## Related Docs

- [Next.js Quickstart](next.md)
- [Document Model](../concepts/document-model.md)
- [Package Reference: md-react](../packages/md-react.md)
