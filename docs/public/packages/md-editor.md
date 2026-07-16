---
title: Headless Editor Session
description: Session state, outline, events, modes, and extension registry.
nav_section: Reference
nav_order: 6
audience: developers
tags:
  - package
  - session
packages:
  - "@momentarise/md-editor"
llms: include
updated: 2026-07-08
---

# Headless Editor Session

`@momentarise/md-editor` owns the headless editor session.

## Use It For

- canonical Markdown content;
- event subscriptions;
- save orchestration;
- mode state;
- AI suggestion state;
- find, replace, and outline APIs;
- extension registry.

## Import

```ts
import { createMarkdownEditorSession } from "@momentarise/md-editor";
import { createMemorySaveTarget } from "@momentarise/md-save";

const content = "# Session\n";
const session = createMarkdownEditorSession({
  content,
  scheduler: { schedule: () => () => {} },
  target: createMemorySaveTarget({ initialContent: content })
});

console.log(session.getOutline());
session.destroy();
```

## Related Docs

- [Headless Quickstart](../quickstart/headless.md)
- [Extensions](../concepts/extensions.md)
