---
title: React Binding API
description: Thin React lifecycle wrapper around MME sessions and DOM surfaces.
nav_section: Reference
nav_order: 9
audience: developers
tags:
  - package
  - react
packages:
  - "@momentarise/md-react"
llms: include
updated: 2026-08-13
---

# React Binding API

`@momentarise/md-react` is a thin React binding around framework-neutral MME packages.

## Use It For

- React lifecycle mounting;
- App Router client-boundary integrations;
- passing session options into the shared editor surface;
- the default editing surfaces: mode control, document status, source, rich, and the selection formatting bubble.

## Import

```tsx
import { MarkdownEditor } from "@momentarise/md-react";

export function Editor({ options }) {
  return <MarkdownEditor options={options} />;
}
```

## Surfaces Mounted By Default

A default mount gives you a working editor with no additional wiring: the mode control, the document status affordance, the source view, the rich view, and — in rich mode — the selection bubble that carries block conversion, bold, italic, strikethrough, inline code, and link.

There is no persistent formatting toolbar. Formatting lives in the selection bubble, matching Notion and BlockNote; a host that wants an always-visible toolbar composes `createToolbar` from `@momentarise/md-surface` itself.

```tsx
<MarkdownEditor
  options={{
    ...sessionOptions,
    // Turn the bubble off if you are building your own formatting surface.
    // There is no half state: `false` mounts nothing rather than a disabled control.
    surfacePreferences: { selectionBubble: false }
  }}
/>
```

## Composing On Top Of The Rich View

`onRichViewReady` hands you the live rich-view handle when rich mode mounts, and `null` when it unmounts. The handle exposes the ProseMirror view, so a host can run commands, read the selection, or add its own surfaces:

```tsx
<MarkdownEditor
  options={{
    ...sessionOptions,
    onRichViewReady(handle) {
      if (!handle) {
        return;
      }
      const view = handle.getEditorView();
      // …register a plugin, read view.state.selection, or drive your own toolbar.
    }
  }}
/>
```

The rich view and everything it depends on are loaded only when the session first enters rich mode, so a consumer who stays in source mode never pays the ProseMirror bundle cost, and the package stays importable inside a server-component boundary.

## Related Docs

- [React Quickstart](../quickstart/react.md)
- [Next.js Quickstart](../quickstart/next.md)
