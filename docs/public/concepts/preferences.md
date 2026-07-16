---
title: Preferences And Locks
description: Hosts resolve user, workspace, document, and locked editor preferences.
nav_section: Features
nav_order: 7
audience: developers
tags:
  - preferences
  - settings
packages:
  - "@momentarise/md-editor"
  - "@momentarise/md-theme"
llms: include
updated: 2026-07-08
---

# Preferences And Locks

Preferences describe editor behavior and surface options without forcing a settings UI.

## Resolution

Preference resolution can combine:

- framework defaults;
- host defaults;
- workspace settings;
- safe document settings;
- user settings.

Any layer can lock a value with a reason. Hosts decide what is visible to users.

## Examples

Useful preferences include toolbar density, AI entry points, mode control style, keybinding delegation, readable line width, font scale, and autosave interval.

## Related Docs

- [Theming](theming.md)
- [Extensions](extensions.md)
- [Headless Editor Session](../packages/md-editor.md)
