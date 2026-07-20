---
title: Surface Components
description: Framework-free toolbar, slash menu, command, status, and AI controls.
nav_section: Features
nav_order: 8
audience: developers
tags:
  - package
  - surface
packages:
  - "@momentarise/md-surface"
llms: include
updated: 2026-07-20
---

# Surface Components

`@momentarise/md-surface` provides framework-free DOM components for shared editor controls.

## Use It For

- toolbar;
- slash menu;
- command palette;
- document status;
- AI assistant surfaces;
- diagnostics and mode controls.

## Host Boundary

Surface components consume tokens, preferences, icons, and injected strings. They do not own application routing or persistence.

## Public API Checkpoints

- `createToolbar` renders the rich editor command toolbar.
- `createSlashMenu` renders grouped slash commands and AI entries.
- `createSelectionBubbleToolbar` renders reusable selected-text action chrome.
- `createDocumentStatus` renders truthful document state without owning persistence.
- `createModeControl` renders document-kind-aware mode controls.
- `SurfaceAssetUploadState` and localized `assetUpload` strings let hosts present idle, pending, inserted, unavailable, denied, and failed image-insertion states without moving storage into the surface package.

## Release Notes

`@momentarise/md-surface` is experimental under the `0.x` compatibility boundary. It provides framework-free DOM components; hosts still own routing, storage, app state, and command dispatch.

## Related Docs

- [Theming](../concepts/theming.md)
- [Extensions](../concepts/extensions.md)
