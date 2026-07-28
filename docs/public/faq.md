---
title: FAQ
description: Answers to common integration and product questions.
nav_section: Reference
nav_order: 90
audience: developers
tags:
  - faq
llms: include
updated: 2026-07-28
---

# FAQ

## Is MME A React Editor

No. React is one binding through `@momentarise/md-react`. The core session, parser, policy, save engine, theme contracts, and DOM surface are framework-agnostic.

## Is MME A Finished App For Non-Developers

No. MME is a framework integrated by developers and product teams.

An MME-powered host can provide rich editing for writers and non-developers, but the host owns final UX, persistence, permissions, credentials, and deployment.

## Is MME A WYSIWYG Editor

MME provides a ProseMirror rich view, but Markdown remains canonical. Rich mode is a derived editing surface, not a replacement source format.

Source mode stays available for exact control and unsupported syntax falls back to raw or opaque preservation.

## Why Not Store JSON Blocks

MME exists so Markdown remains the durable source. JSON state may exist in memory only if it serializes safely back to Markdown.

## Can The Docs Use MDX

No for the public source docs. MDX mixes Markdown with JSX and needs a build pipeline. Public docs stay plain `.md` so MME can parse, preserve, render, and expose them as raw Markdown.

## Can Hosts Render React Components

Yes, a host can render custom UI around MME or map a preserved custom block to a component. That does not make React executable source inside public docs.

## Is AI Built In

No hosted AI service ships with MME.

MME defines provider-neutral writing contracts, staged suggestions, policy checks, and an OpenAI-compatible adapter path. Production hosts own credentials, network transport, provider selection, billing, and logs.

## Can I Install MME From The Public Npm Registry

Not yet. Current packages are experimental `0.x` workspace packages and are not published to the public npm registry.

Repository quickstarts are validated against packed workspace tarballs. They document intended package interfaces, not current registry availability.

## Does MME Integrate With Payload CMS

No Payload CMS adapter ships today.

Payload can become a future host integration if it preserves Markdown/YAML frontmatter truth, permissions, media, draft/publish state, and persistence boundaries. MME and any Payload-backed product remain separate projects.

## Was MME Built With AI Or Vibe Coding

AI-assisted engineering may be part of the development process, but it is not a runtime capability, quality guarantee, architecture, or adoption reason.

Evaluate MME through source code, tests, preservation gates, public APIs, security boundaries, and compatibility status. The project does not use “vibe coding” as a framework claim.

## Will Publishing These Docs Make Agents Cite MME

No guarantee exists.

Plain Markdown, stable URLs, `llms.txt`, a machine-readable product profile, and source-linked agent skills can improve retrieval and verification. Search engines and language models control their own crawling, indexing, ranking, and citation behavior.

## Related Docs

- [Document Model](concepts/document-model.md)
- [AI And Privacy](concepts/ai-privacy.md)
- [Choosing MME](choosing-mme.md)
- [Agentic Experience](concepts/agentic-experience.md)
- [Compatibility Promise](compatibility-promise.md)
