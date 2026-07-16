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

## Related Docs

- [Save Truthfulness](../concepts/save-truthfulness.md)
- [Web File Access](md-adapter-web.md)
