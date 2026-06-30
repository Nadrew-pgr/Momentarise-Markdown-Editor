# @momentarise/md-react

Experimental React binding for Momentarise Markdown Editor.

This package is only lifecycle glue. Markdown parsing, session state, save behavior, policy, theming, source editing, and surface controls stay in framework-agnostic packages.

## App Router

Create a client component:

```tsx
"use client";

import { MarkdownEditor } from "@momentarise/md-react";
import { createMemorySaveTarget } from "@momentarise/md-save";

export function MarkdownEditorClient() {
  return (
    <MarkdownEditor
      options={{
        content: "# Hello\n",
        scheduler: {
          schedule(callback, delayMs) {
            const id = window.setTimeout(() => void callback(), delayMs);
            return () => window.clearTimeout(id);
          }
        },
        target: createMemorySaveTarget({ initialContent: "# Hello\n" })
      }}
    />
  );
}
```

Then load it from a server component with `next/dynamic` and `ssr: false`.

```tsx
import dynamic from "next/dynamic";

const MarkdownEditorClient = dynamic(() => import("./MarkdownEditorClient"), {
  ssr: false
});

export default function Page() {
  return <MarkdownEditorClient />;
}
```

The package does not access DOM globals at module import time. The editor mounts only after React attaches the container element.
