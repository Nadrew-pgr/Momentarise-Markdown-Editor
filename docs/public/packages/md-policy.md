---
title: "Package: md-policy"
description: Document Access Policy baseline for MME.
nav_section: Packages
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

# Package: md-policy

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
  path: "file://notes/README.md",
  capability: "read"
});

console.log(decision.status);
```

## Related Docs

- [Document Access Policy](../concepts/policy.md)
- [AI And Privacy](../concepts/ai-privacy.md)
