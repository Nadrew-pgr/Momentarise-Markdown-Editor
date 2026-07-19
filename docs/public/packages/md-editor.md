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
updated: 2026-07-19
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

## Public API Checkpoints

- `createMarkdownEditorSession` owns the headless document session.
- `createMarkdownImageReference`, `insertMarkdownImageReference`, and `session.insertAsset` let hosts wire image paste/drop/import flows without making MME own storage.
- `createExtensionRegistry` collects host-provided commands, slash items, toolbar items, custom blocks, and AI actions.
- `editorModesForDocumentKind` keeps Markdown and HTML artifact mode controls honest.
- `resolvePreferences` applies host, workspace, document, and locked preference layers.

## Release Notes

`@momentarise/md-editor` is experimental under the `0.x` compatibility boundary. It is host-independent orchestration, not a UI shell or persistence adapter.

## Related Docs

- [Headless Quickstart](../quickstart/headless.md)
- [Extensions](../concepts/extensions.md)
