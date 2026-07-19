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

## Public API Checkpoints

- `createOpenAiCompatibleProvider` builds an OpenAI-compatible provider from host-injected transport.
- `createMockAiProvider` is the default deterministic test/demo provider.
- `requestAiSuggestion` requests a staged writing suggestion after policy approval.
- `acceptAiSuggestion` and `rejectAiSuggestion` keep AI changes explicit and reviewable.

## Release Notes

`@momentarise/md-ai` is experimental under the `0.x` compatibility boundary. It defines provider contracts and helper factories; production hosts still own credentials, network transport, billing, secure storage, and logs.

## Related Docs

- [AI And Privacy](../concepts/ai-privacy.md)
- [AI Provider Adapter](../AI_PROVIDER_ADAPTER.md)
