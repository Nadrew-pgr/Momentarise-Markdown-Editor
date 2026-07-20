---
title: Editor UI
description: Source mode, rich view, toolbar, slash menu, outline, and status surfaces.
nav_section: Features
nav_order: 1
audience: developers
tags:
  - ui
  - editor
llms: include
updated: 2026-07-20
---

# Editor UI

MME is built for apps that need modern editor ergonomics without surrendering Markdown as the saved document.

## Editing Surfaces

- Source mode uses CodeMirror 6 and edits Markdown directly.
- Rich mode is a ProseMirror-derived view over supported Markdown.
- Rendered HTML is a read surface for docs, previews, print, and export flows.
- Outline and find/replace come from the headless editor session, not page-specific UI state.

Unsupported syntax must remain reachable through source mode. A polished view is useful only if it does not hide the real document from the user.

## Command Surfaces

MME exposes commands through the extension registry so hosts can assemble the UI they need:

- slash commands for block insertion and AI entry points;
- toolbar and bubble toolbar actions;
- command palette entries;
- host-provided commands;
- custom block registrations.

The default surface is framework-free. React and Next.js consume it through bindings or client boundaries; they do not own the editor model.

## Assets

Image paste, drop, and import flows use a host-owned asset provider. MME does not ship a storage service or hidden asset database. When a provider returns a safe URL/path, MME inserts normal Markdown image syntax and preserves the surrounding source.

If no provider is configured, callers receive an `unavailable` result. If upload is denied by policy, the provider fails, the document changes while upload is pending, or a rich selection cannot map safely to Markdown source, callers receive a structured non-inserted result. The document stays unchanged by that upload attempt.

The reference editor exposes the same path through its **Insert image** action, slash command, image paste, and image drop. Its local demo provider returns `./assets/...` references to demonstrate integration only; it does not copy the selected binary or provide production storage. A real host must replace that provider with storage it owns and return the persisted URL or path.

## Status Surfaces

Save state is part of the UI contract. A host should show whether the current document is saved to disk, memory-only, downloadable, conflicted, or errored.

## Related Docs

- [Extensions](extensions.md)
- [Save Truthfulness](save-truthfulness.md)
- [Surface Components](../packages/md-surface.md)
- [CodeMirror Source View](../packages/md-source-codemirror.md)
- [ProseMirror Rich View](../packages/md-rich-prosemirror.md)
