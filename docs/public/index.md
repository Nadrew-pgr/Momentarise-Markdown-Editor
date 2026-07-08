---
title: Momentarise Markdown Editor
description: Markdown-native framework for portable, preservation-first document editors.
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

Use it when you want rich editing, source editing, save truth, AI writing assistance, theming, and host adapters without turning user documents into a hidden JSON or block database.

## What It Guarantees

- Markdown plus optional YAML frontmatter is the persisted source.
- Rich editing is a derived view, not the storage format.
- Source mode stays available for exact control.
- Unsupported syntax must be preserved, not silently deleted.
- Save state must say where content was actually persisted.
- AI writing stays staged and policy-gated.

## Start Here

- Vanilla web: [Vanilla Quickstart](quickstart/vanilla.md)
- React: [React Quickstart](quickstart/react.md)
- Next.js: [Next.js Quickstart](quickstart/next.md)
- Headless Node: [Headless Quickstart](quickstart/headless.md)
- Core model: [Document Model](concepts/document-model.md)
- Preservation: [Preservation](concepts/preservation.md)
- Save status: [Save Truthfulness](concepts/save-truthfulness.md)
- Package map: [Package Reference](packages/md-core.md)

## Why Not MDX As The Source

MDX is useful for React documentation sites, but it makes page source a mix of Markdown and executable JSX.

MME docs use plain `.md` because the framework must prove its own contract: portable Markdown can be read by humans, coding agents, GitHub, the MME parser, and the future docs site without a React build pipeline.

The future docs site can still be a React or Vite app. Its content source remains Markdown.

## Current Status

All packages are experimental under the [Compatibility Promise](compatibility-promise.md). Public APIs are audited, but `0.x` releases may still ship breaking changes in minor versions.
