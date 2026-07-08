---
title: "Package: md-react"
description: Thin React binding for MME sessions and DOM surface.
nav_section: Packages
nav_order: 9
audience: developers
tags:
  - package
  - react
packages:
  - "@momentarise/md-react"
llms: include
updated: 2026-07-08
---

# Package: md-react

`@momentarise/md-react` is a thin React binding around framework-neutral MME packages.

## Use It For

- React lifecycle mounting;
- App Router client-boundary integrations;
- passing session options into the shared editor surface.

## Import

```tsx
import { MarkdownEditor } from "@momentarise/md-react";

export function Editor({ options }) {
  return <MarkdownEditor options={options} />;
}
```

## Related Docs

- [React Quickstart](../quickstart/react.md)
- [Next.js Quickstart](../quickstart/next.md)
