---
title: Document Access Policy API
description: Gate read, write, share, export, and AI access before work happens.
nav_section: Reference
nav_order: 4
audience: developers
tags:
  - package
  - policy
packages:
  - "@momentarise/md-policy"
llms: include
updated: 2026-07-08
---

# Document Access Policy API

`@momentarise/md-policy` resolves document access decisions before sensitive operations.

## Use It For

- read, write, share, export, and index decisions;
- hard-deny defaults for secrets and private files;
- warning and override metadata;
- host policy composition.

## Import

```ts
import { createDefaultPolicyResolver } from "@momentarise/md-policy";

const resolver = createDefaultPolicyResolver();
const decision = resolver.resolve({
  capability: "read",
  subject: {
    documentPath: "file://notes/README.md"
  }
});

console.log(decision.allowed);
```

## Related Docs

- [Document Access Policy](../concepts/policy.md)
- [AI And Privacy](../concepts/ai-privacy.md)
