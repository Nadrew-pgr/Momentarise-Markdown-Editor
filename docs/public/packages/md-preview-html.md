---
title: HTML And SVG Artifact Preview
description: Sandboxed preview descriptors for standalone HTML and sanitized SVG files.
nav_section: Features
nav_order: 13
audience: developers
tags:
  - package
  - html
  - svg
packages:
  - "@momentarise/md-preview-html"
llms: include
updated: 2026-07-19
---

# HTML And SVG Artifact Preview

`@momentarise/md-preview-html` handles standalone artifact preview descriptors for HTML and SVG sources.

## Use It For

- sandboxed iframe preview defaults;
- script-disabled HTML artifact reading;
- sanitized SVG artifact reading through `createSandboxedSvgPreview`;
- host policy around HTML compatibility tokens.

## Boundary

Standalone `.html` and `.svg` artifacts are not Markdown documents. Markdown inline or block HTML is rendered by [md-render-html](md-render-html.md).

HTML preview preserves source as iframe `srcdoc` and relies on an empty script-disabled sandbox by default.

SVG preview first produces a conservative sanitized derived artifact. V0 keeps simple drawing elements and strips unsupported or active elements, event attributes, script/data URL protocols, external references, remote CSS, and image references before rendering. The original SVG source remains the editable and saved text.

## Related Docs

- [Document Model](../concepts/document-model.md)
- [HTML Renderer](md-render-html.md)
