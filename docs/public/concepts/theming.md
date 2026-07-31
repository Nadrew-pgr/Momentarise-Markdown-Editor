---
title: Theming
description: Theme MME through tokens, host theme objects, icons, and class maps.
nav_section: Styling
nav_order: 6
audience: developers
tags:
  - theming
  - customization
packages:
  - "@momentarise/md-theme"
llms: include
updated: 2026-07-08
---

# Theming

MME separates framework tokens from host styling.

## Component Stylesheet

`@momentarise/md-theme` ships the visual design for every editor surface (source view, rich content, toolbar, selection bubble, slash menu, block handles, tables, callouts, code, footnotes, task lists, status and mode controls) as a plain, importable stylesheet. Import it once and the editor looks like the reference demo instead of unstyled browser controls. It also pulls in the token layer, so this single import is all you need.

Vanilla / any bundler:

```css
@import "@momentarise/md-theme/styles.css";
```

React or Next.js (from a client component or your global stylesheet):

```ts
import "@momentarise/md-theme/styles.css";
```

Framework-free `<link>`:

```html
<link rel="stylesheet" href="/node_modules/@momentarise/md-theme/src/styles.css" />
```

The stylesheet is ESM/bundler-friendly and requires no build step. Every rule consumes `--mme-*` tokens, so you restyle by overriding tokens — not by patching selectors.

### Light and dark

Colors default to the visitor's `prefers-color-scheme`. Pin a scheme explicitly on any ancestor (usually `<html>`):

```html
<html data-mme-scheme="dark">
```

`data-mme-scheme="light"` and `data-mme-scheme="dark"` always win over the media default.

## Token Layers

The default theme exposes `--mme-*` custom properties for color roles, typography, spacing, radius, shadows, and layers.

Hosts can customize through:

- framework tokens;
- typed theme objects;
- icon set contract;
- component class map overrides;
- plain CSS as last resort.

## Host Control

The host decides whether settings are global, workspace-level, document-level, user-level, or locked.

MME does not require a built-in settings screen.

## Related Docs

- [Preferences](preferences.md)
- [Theme System](../packages/md-theme.md)
- [Surface Components](../packages/md-surface.md)
