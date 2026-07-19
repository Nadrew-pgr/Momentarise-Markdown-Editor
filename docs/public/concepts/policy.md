---
title: Document Access Policy
description: Policy decisions gate read, write, share, export, and AI access.
nav_section: Foundations
nav_order: 4
audience: developers
tags:
  - policy
  - security
packages:
  - "@momentarise/md-policy"
llms: include
updated: 2026-07-19
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

## Asset Uploads

Asset upload is host-owned. MME checks policy before asset egress and document mutation: `export` covers sending the pasted or dropped asset to a host provider, and `write` covers inserting the resulting Markdown image reference into the document.

If policy denies either capability, the provider is not called and the document is unchanged.

## Related Docs

- [AI And Privacy](ai-privacy.md)
- [Document Access Policy API](../packages/md-policy.md)
- [CLI For Agents And Developers](../packages/md-cli.md)
