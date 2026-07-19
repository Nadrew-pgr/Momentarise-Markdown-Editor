---
title: Save Engine
description: Dirty, saved, conflict, and persistence-target contracts.
nav_section: Reference
nav_order: 3
audience: developers
tags:
  - package
  - save
packages:
  - "@momentarise/md-save"
llms: include
updated: 2026-07-08
---

# Save Engine

`@momentarise/md-save` tracks document save state independently from any host.

## Use It For

- dirty, saving, saved, conflict, and error states;
- memory save targets;
- hash-based overwrite protection;
- adapter-owned persistence targets.

## Import

```ts
import { createMemorySaveTarget } from "@momentarise/md-save";

const target = createMemorySaveTarget({
  initialContent: "# Draft\n"
});
```

## Public API Checkpoints

- `createSaveEngine` tracks dirty, saving, saved, conflict, and error states.
- `createMemorySaveTarget` is useful for tests and non-disk demos.
- `createDownloadRequiredSaveTarget` describes export/download-only persistence truthfully.
- `persistenceTargetLabel` converts target kind into user-facing save truth.

## Release Notes

`@momentarise/md-save` is experimental under the `0.x` compatibility boundary. A `saved` state must describe the real target that was written; hosts own disk, browser, backend, or IDE file-service implementations.

## Related Docs

- [Save Truthfulness](../concepts/save-truthfulness.md)
- [Web File Access](md-adapter-web.md)
