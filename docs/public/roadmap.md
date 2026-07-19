---
title: Roadmap
description: Public framework direction for MME.
nav_section: Reference
nav_order: 100
audience: developers
tags:
  - roadmap
llms: include
updated: 2026-07-19
---

# Roadmap

MME V0 focuses on framework credibility: preservation, source/rich editing, truthful save behavior, host-independent packages, adapters, and public docs.

## Current Foundation

- Source mode uses CodeMirror.
- Rich mode uses ProseMirror as first spike.
- Headless editor session owns canonical content.
- Save Engine tracks dirty, saved, conflict, and error states.
- Policy gates AI and sensitive file access.
- React and Theia paths prove host integration.
- Asset upload contracts let hosts insert Markdown image references from paste/drop/import flows without making MME own storage.

## Near-Term Public Readiness

- Public docs content baseline.
- Public docs site rendered from real Markdown.
- Generated `llms.txt` and `llms-full.txt`.
- More docs recipes and migration guides.

## Future Work

- VS Code and desktop adapter paths.
- Mobile and tablet input pass.
- Table and footnote editing.
- Live preview parity.
- CMS and publishing integrations.

## Related Docs

- [Overview](index.md)
- [Preservation](concepts/preservation.md)
- [Extensions](concepts/extensions.md)
