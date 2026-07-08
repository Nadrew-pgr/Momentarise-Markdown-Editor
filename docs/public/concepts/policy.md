---
title: Document Access Policy
description: Policy decisions gate read, write, share, export, and AI access.
nav_section: Concepts
nav_order: 4
audience: developers
tags:
  - policy
  - security
packages:
  - "@momentarise/md-policy"
llms: include
updated: 2026-07-08
---

# Document Access Policy

Document Access Policy is the framework boundary for deciding whether content can be read, written, indexed, shared, exported, or sent to AI.

## Capabilities

Common capabilities include:

- `exists`;
- `metadata`;
- `read`;
- `index`;
- `write`;
- `execute`;
- `share`;
- `export`.

## Decisions

Policy returns structured decisions:

- allow;
- warn;
- deny.

The decision can include reason, source, severity, override status, and confirmation requirements. Hosts decide the final presentation.

## Hard Deny

Secrets, tokens, `.env` files, keys, identity documents, banking documents, and private folders can be hard-denied by default policy or host policy.

## Related Docs

- [AI And Privacy](ai-privacy.md)
- [Package Reference: md-policy](../packages/md-policy.md)
- [Package Reference: md-cli](../packages/md-cli.md)
