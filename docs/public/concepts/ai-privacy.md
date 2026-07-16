---
title: AI And Privacy
description: AI writing is assistive, staged, and policy-gated.
nav_section: Features
nav_order: 5
audience: developers
tags:
  - ai
  - privacy
packages:
  - "@momentarise/md-ai"
llms: include
updated: 2026-07-08
---

# AI And Privacy

MME AI is writing assistance. It is not an autonomous workspace agent, RAG system, or tool-execution runtime.

## Suggestion Flow

AI output is staged:

1. The host or user asks for help.
2. Document Access Policy checks whether content can be shared.
3. The provider returns a suggestion.
4. The user explicitly accepts or rejects.
5. Stale suggestions cannot apply after the source hash changes.

## Provider Paths

Supported patterns:

- mock provider for tests and demos;
- host-managed backend provider for production;
- local sidecar or gateway;
- memory-only personal BYOK for local use.

Production apps should avoid direct browser-to-provider keys unless the user explicitly configures a personal local workflow.

## Related Docs

- [AI Provider Adapter](../AI_PROVIDER_ADAPTER.md)
- [Document Access Policy](policy.md)
- [AI Writing API](../packages/md-ai.md)
