---
title: Next.js Quickstart
description: Use the React binding from a client-only Next.js boundary.
nav_section: Getting Started
nav_order: 3
audience: developers
tags:
  - nextjs
  - quickstart
packages:
  - "@momentarise/md-react"
llms: include
updated: 2026-07-28
---

# Next.js Quickstart

MME packages avoid DOM globals at module import where required, but the editor itself is an interactive client surface. In Next.js App Router, mount it from a client component.

The packages are experimental and published to npm under the `alpha` dist-tag (`0.1.0-alpha.3`), not `latest`.

```bash
npm install @momentarise/md-react@alpha @momentarise/md-save@alpha
```

`@momentarise/md-react` declares a peer dependency range of `react: "^18 || ^19"`, which covers the React version Next.js App Router ships by default. Packages are ESM-only (`"type": "module"`, no CommonJS build). See [Compatibility Promise](../compatibility-promise.md).

## Client Component

```tsx
"use client";

import { MarkdownEditor } from "@momentarise/md-react";
import { createMemorySaveTarget } from "@momentarise/md-save";

const content = "# Next.js host\n\nRender MME in a client boundary.\n";

export function MarkdownEditorClient() {
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

## Server Component Wrapper

A Server Component can import and render a `"use client"` component directly; no `next/dynamic` wrapper is needed for this. (An earlier version of this doc used `dynamic(..., { ssr: false })`, which current Next.js rejects when called from a Server Component — that pattern is only valid inside another Client Component.)

```tsx
import { MarkdownEditorClient } from "./markdown-editor-client";

export default function Page() {
  return <MarkdownEditorClient />;
}
```

## Editing Modes

The binding mounts a real surface for both modes it offers — Source (CodeMirror) and Rich (ProseMirror) — and swaps them while the session keeps canonical Markdown. The rich view is dynamically imported on first use, so it never enters the server bundle and never runs during SSR; add its optional peers to enable it:

```bash
npm install @momentarise/md-rich-prosemirror@alpha prosemirror-view
```

Live Preview is not offered by this binding (no surface to mount), so no inert control appears.

## Working Example

`examples/next-app/` in the repository is a complete, registry-installed Next.js App Router project built from exactly this pattern, with React 19, StrictMode, and a working Source/Rich toggle. See its `app/page.tsx` and `app/markdown-editor-client.tsx`.

## Production Notes

Use a host-managed save target for production storage. Use a host backend or sidecar for production AI provider credentials.

See [AI And Privacy](../concepts/ai-privacy.md) and [Policy](../concepts/policy.md).
