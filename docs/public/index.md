---
title: Momentarise Markdown Editor
description: Build portable Markdown editors with rich UX, AI assistance, truthful saves, and host-independent contracts.
nav_section: Start
nav_order: 1
audience: developers
tags:
  - overview
  - markdown
llms: include
updated: 2026-07-08
---

# Momentarise Markdown Editor

Momentarise Markdown Editor is a framework for building modern document editors where real Markdown files stay the durable source of truth.

Use it when you want source editing, rich editing, HTML rendering, AI writing assistance, theming, and host adapters without turning user documents into a hidden JSON or block database.

## Why MME

Most rich-text frameworks make their own block model the durable document. MME takes the opposite route: Markdown remains portable, inspectable, diffable, and editable outside the app.

That changes the integration model:

- source mode is first-class, not a fallback textarea;
- rich and rendered views are derived from Markdown;
- unknown syntax is preserved instead of flattened;
- save state names the real persistence target;
- AI suggestions stay staged, hash-aware, and policy-gated.

## Start Building

- [Vanilla Quickstart](quickstart/vanilla.md): mount MME without a framework.
- [React Quickstart](quickstart/react.md): use the thin React lifecycle binding.
- [Next.js Quickstart](quickstart/next.md): isolate the editor behind a client boundary.
- [Headless Quickstart](quickstart/headless.md): run sessions, save logic, outline, and AI without UI.

## Core Guides

- [Document Model](concepts/document-model.md): what is persisted and what is derived.
- [Preservation](concepts/preservation.md): how Markdown bytes and unknown syntax survive.
- [Save Truthfulness](concepts/save-truthfulness.md): how saved, dirty, conflict, and memory-only states work.
- [AI And Privacy](concepts/ai-privacy.md): staged writing assistance without bypassing policy.
- [Extensions](concepts/extensions.md): register commands, slash items, toolbar entries, AI actions, and custom blocks.

## Why Not MDX As The Source

MDX is useful for React documentation sites, but it makes page source a mix of Markdown and executable JSX.

MME docs use plain `.md` because the framework must prove its own contract: portable Markdown can be read by humans, coding agents, GitHub, the MME parser, and the future docs site without a React build pipeline.

The public docs site is a Next.js shell, but its content source remains plain Markdown rendered through MME.

## Reference

Use [Core Contracts](packages/md-core.md), [Markdown Parser And Serializer](packages/md-format.md), [Headless Editor Session](packages/md-editor.md), [Surface Components](packages/md-surface.md), and [HTML Renderer](packages/md-render-html.md) when you need the package-level API map.

## Current Status

All packages are experimental under the [Compatibility Promise](compatibility-promise.md). Public APIs are audited, but `0.x` releases may still ship breaking changes in minor versions.
