---
title: AI Writing API
description: Provider-neutral, policy-gated writing suggestions.
nav_section: Reference
nav_order: 5
audience: developers
tags:
  - package
  - ai
packages:
  - "@momentarise/md-ai"
llms: include
updated: 2026-07-08
---

# AI Writing API

`@momentarise/md-ai` defines AI writing provider contracts and OpenAI-compatible adapter helpers.

## Use It For

- staged AI writing suggestions;
- mock providers for tests;
- host-injected transport;
- OpenAI-compatible local gateway or host backend paths.

## Import

```ts
import { createMockAiProvider } from "@momentarise/md-ai";

const provider = createMockAiProvider();
```

## Related Docs

- [AI And Privacy](../concepts/ai-privacy.md)
- [AI Provider Adapter](../AI_PROVIDER_ADAPTER.md)
