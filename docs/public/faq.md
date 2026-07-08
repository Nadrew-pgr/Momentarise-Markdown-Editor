---
title: FAQ
description: Answers to common integration and product questions.
nav_section: Reference
nav_order: 90
audience: developers
tags:
  - faq
llms: include
updated: 2026-07-08
---

# FAQ

## Is MME A React Editor

No. React is one binding through `@momentarise/md-react`. The core session, parser, policy, save engine, theme contracts, and DOM surface are framework-agnostic.

## Why Not Store JSON Blocks

MME exists so Markdown remains the durable source. JSON state may exist in memory only if it serializes safely back to Markdown.

## Can The Docs Use MDX

No for the public source docs. MDX mixes Markdown with JSX and needs a build pipeline. Public docs stay plain `.md` so MME can parse, preserve, render, and expose them as raw Markdown.

## Can Hosts Render React Components

Yes, a host can render custom UI around MME or map a preserved custom block to a component. That does not make React executable source inside public docs.

## Is AI Built In

MME defines AI contracts and a provider adapter path. Production hosts should own credentials, network transport, billing, and logs.

## Related Docs

- [Document Model](concepts/document-model.md)
- [AI And Privacy](concepts/ai-privacy.md)
- [Compatibility Promise](compatibility-promise.md)
