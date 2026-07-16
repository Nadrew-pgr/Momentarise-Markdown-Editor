---
title: Preservation
description: How MME protects Markdown bytes and unknown syntax.
nav_section: Foundations
nav_order: 2
audience: developers
tags:
  - preservation
  - roundtrip
llms: include
updated: 2026-07-08
---

# Preservation

Preservation is the rule that MME must not silently destroy source bytes it does not own.

## Round Trip

An untouched Markdown document should parse and serialize without content loss. Unsupported syntax is preserved as raw or opaque content.

Examples of content that must be protected:

- YAML frontmatter;
- GFM tables;
- task lists;
- code fences;
- raw inline or block HTML;
- Mermaid fences;
- LaTeX;
- Obsidian-style callouts;
- wikilinks;
- unknown custom syntax.

## Targeted Edits

When a rich or headless operation changes one block, unrelated source should stay byte-for-byte stable where the framework has source ranges.

This protects author formatting, blank lines, list markers, fence styles, and syntax the current view cannot model.

## Unsafe Shortcut

A full-document rewrite may look clean in a demo but can corrupt real files. MME prefers narrower edits with source-range proof.

## Related Docs

- [Document Model](document-model.md)
- [Markdown Parser And Serializer](../packages/md-format.md)
- [Glossary](../GLOSSARY.md)
