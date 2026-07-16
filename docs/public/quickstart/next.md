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
updated: 2026-07-08
---

# Next.js Quickstart

MME packages avoid DOM globals at module import where required, but the editor itself is an interactive client surface. In Next.js App Router, mount it from a client component.

## Client Component

```tsx
"use client";

import { MarkdownEditor } from "@momentarise/md-react";
import { createMemorySaveTarget } from "@momentarise/md-save";

const content = "# Next.js host\n\nRender MME in a client boundary.\n";

export default function MarkdownEditorClient() {
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

```tsx
import dynamic from "next/dynamic";

const MarkdownEditorClient = dynamic(() => import("./MarkdownEditorClient"), {
  ssr: false
});

export default function Page() {
  return <MarkdownEditorClient />;
}
```

## Production Notes

Use a host-managed save target for production storage. Use a host backend or sidecar for production AI provider credentials.

See [AI And Privacy](../concepts/ai-privacy.md) and [Policy](../concepts/policy.md).
