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
