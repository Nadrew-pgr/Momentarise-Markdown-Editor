---
title: Headless Quickstart
description: Use the headless editor session without rendering UI.
nav_section: Getting Started
nav_order: 4
audience: developers
tags:
  - headless
  - node
packages:
  - "@momentarise/md-editor"
  - "@momentarise/md-save"
llms: include
updated: 2026-07-28
---

# Headless Quickstart

Use the headless session when you need Markdown orchestration without UI: tests, server-side inspection, CLI tools, adapters, or agent workflows.

The packages are experimental and published to npm under the `alpha` dist-tag (`0.1.0-alpha.3`), not `latest`.

```bash
npm install @momentarise/md-editor@alpha @momentarise/md-save@alpha
```

Packages are ESM-only (`"type": "module"`, no CommonJS build). Import with `import`, not `require`. See [Compatibility Promise](../compatibility-promise.md).

## Create A Session

```ts
import { createMarkdownEditorSession } from "@momentarise/md-editor";
import { createMemorySaveTarget } from "@momentarise/md-save";

const content = "# Headless\n\nFind and save without mounting UI.\n";

const session = createMarkdownEditorSession({
  content,
  scheduler: {
    schedule() {
      return () => {};
    }
  },
  target: createMemorySaveTarget({ initialContent: content })
});

const matches = session.find("save", { caseSensitive: false });
const outline = session.getOutline();

console.log({ matches, outline });
session.destroy();
```

## What This Proves

The editor model does not require React, Theia, VS Code, CodeMirror, or ProseMirror to manage canonical content.

Views are attached layers. The session is the integration contract.

## Related Docs

- [Document Model](../concepts/document-model.md)
- [Extensions](../concepts/extensions.md)
- [Headless Editor Session](../packages/md-editor.md)
