---
title: Save Truthfulness
description: Save state must describe the real persistence target.
nav_section: Concepts
nav_order: 3
audience: developers
tags:
  - save
  - persistence
packages:
  - "@momentarise/md-save"
llms: include
updated: 2026-07-08
---

# Save Truthfulness

MME save state must tell users what actually happened to their document.

The UI must not say only `saved` when the user cannot tell where content went.

## Persistence Targets

Supported target labels include:

- disk;
- memory only;
- download required;
- unsupported;
- conflict;
- error.

## Real File Saves

When a host opens a writable local file, save and autosave should write to that original file and verify external changes before overwrite.

When a host imports a copy through fallback upload, MME cannot overwrite the original file. The UI must say export or download is required.

## External Changes

External-change detection is adapter-owned. The Save Engine owns hash comparison and no-overwrite state.

If local content is clean and the adapter can read external content, the host may apply the external change. If local content is dirty, MME must preserve local edits and enter conflict state.

## Related Docs

- [Package Reference: md-save](../packages/md-save.md)
- [Package Reference: md-adapter-web](../packages/md-adapter-web.md)
- [Package Reference: md-adapter-theia](../packages/md-adapter-theia.md)
