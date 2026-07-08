---
title: Extensions
description: Register commands, toolbar items, slash items, AI actions, and custom blocks.
nav_section: Concepts
nav_order: 8
audience: developers
tags:
  - extensions
  - commands
packages:
  - "@momentarise/md-editor"
llms: include
updated: 2026-07-08
---

# Extensions

MME uses registries instead of closed unions for host-visible commands.

## Extension Points

Hosts can register:

- slash menu items;
- toolbar items;
- keybindings;
- AI actions;
- custom block serializers;
- input rules where supported.

## Namespacing

Host extensions should use namespaced IDs such as `host:insert-decision-card`. Built-in commands use the same registry path as host commands.

## Source Safety

Custom blocks need an explicit Markdown serialization contract. If the rich view cannot model a block safely, it must preserve source bytes.

## Related Docs

- [Document Model](document-model.md)
- [Preservation](preservation.md)
- [Package Reference: md-editor](../packages/md-editor.md)
