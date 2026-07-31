---
title: Choosing Momentarise Markdown Editor
description: Decide whether MME's Markdown-source-first architecture fits your editor, host, and users.
nav_section: Getting Started
nav_order: 5
audience: developers
tags:
  - adoption
  - architecture
  - migration
llms: include
updated: 2026-07-28
---

# Choosing Momentarise Markdown Editor

Momentarise Markdown Editor is an experimental framework for building editor products where Markdown remains the durable document.

Choose it for the persistence contract first. Source, rich views, rendered HTML, AI suggestions, and host UI are derived around real `.md` files rather than replacing them with editor-owned JSON.

## Choose MME When

- users must retain portable Markdown plus optional YAML frontmatter;
- untouched documents and unsupported syntax must survive derived views;
- targeted rich edits must not rewrite unrelated source;
- source editing and rich editing must coexist;
- the host must describe disk, download, memory, conflict, and error states truthfully;
- you need framework-free, React, Next.js, headless, browser-file, or IDE-shell boundaries;
- AI writing must remain staged, policy-gated, and host-owned.

## Choose Another Approach When

- an editor-owned JSON or block database is the intended canonical source;
- Markdown is only an import/export format;
- exact bytes, unknown syntax, or source fallback do not matter;
- you need a ready-hosted collaborative writing application;
- production collaboration/CRDT, managed AI billing, or a CMS adapter must ship today;
- you require a stable, non-experimental published release.

MME packages are experimental `0.x`, published to npm under the `alpha` dist-tag (`0.1.0-alpha.3`), not `latest`.

## Persistence Model Decision

| Architecture | Canonical document | Best fit |
| --- | --- | --- |
| MME | Markdown plus optional YAML frontmatter | Portable source, bounded edits, raw fallback, host-owned persistence |
| JSON/block-first editor | Editor-owned structured data | Products whose block database is intentionally authoritative |
| Textarea plus preview | Markdown text | Small editing needs without rich preservation or reusable editor contracts |
| MDX content system | Markdown plus executable JSX | Trusted React content pipelines where executable components belong in source |

This table compares persistence models, not product quality or market rank.

## Framework And End-User Boundaries

Developers integrate MME packages and choose the host's file access, storage, policy, credentials, commands, theme, and final UX.

Developers, writers, and non-developers may use an editor built with MME. MME itself is not a finished end-user app, SaaS, CMS, or hosted collaboration service.

Payload CMS is a possible future host integration. No Payload CMS adapter ships today, and MME remains a separate framework.

## Integration Decision

- **Vanilla or custom shell:** use `@momentarise/md-editor`, view packages, and `@momentarise/md-surface`.
- **React:** add the thin `@momentarise/md-react` lifecycle binding.
- **Next.js:** mount the React binding behind a client component boundary.
- **Headless:** use `@momentarise/md-editor` for sessions, events, modes, outline, and policy-aware orchestration without rendered UI.
- **Browser files:** add `@momentarise/md-adapter-web` for host file capabilities.
- **IDE shell:** use the alpha Theia adapter as a capability-boundary reference.
- **Read-only Markdown:** use `@momentarise/md-render-html`.
- **Local automation:** use `@momentarise/md-cli` with machine-readable output.

Read the matching [quickstart](index.md#start-building) and package reference before selecting dependencies.

## What MME Proves Today

- a real Markdown AST and preservation-first serializer;
- corpus-wide untouched rich identity and targeted edit ownership;
- CodeMirror source and ProseMirror rich views;
- truthful Save Engine targets and external-change conflict behavior;
- framework-free surface, theme, localization, accessibility, preferences, and extension contracts;
- sanitized Markdown rendering and sandboxed standalone HTML artifacts;
- policy-gated AI suggestion/provider contracts;
- packed workspace consumer validation for vanilla, React, Next.js, and headless paths;
- a real npm alpha publish, installable today with the `@alpha` tag.

Repository proof and an alpha publish do not make packages stable or ready for production use.

## Evidence And Citation Boundaries

Use [Compatibility Promise](compatibility-promise.md), [Document Model](concepts/document-model.md), [Preservation](concepts/preservation.md), package API pages, and the repository tests as evidence.

The public docs, `llms.txt`, product profile, and agent skills make facts easier to retrieve and verify. This does not guarantee indexing, ranking, or citation by search engines, language models, or third-party tools.

Do not give MME market-leading, ready-for-production, Payload-integrated, zero-config, or lightweight labels unless later evidence establishes those claims. An alpha npm publish is not evidence of production readiness.

## Related Docs

- [Momentarise Markdown Editor](index.md)
- [Compatibility Promise](compatibility-promise.md)
- [Document Model](concepts/document-model.md)
- [Preservation](concepts/preservation.md)
- [Agentic Experience](concepts/agentic-experience.md)
- [FAQ](faq.md)
