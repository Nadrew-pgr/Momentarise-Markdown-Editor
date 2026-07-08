---
title: "Package: md-format"
description: Parser and serializer contracts for MME.
nav_section: Packages
nav_order: 2
audience: developers
tags:
  - package
packages:
  - "@momentarise/md-format"
llms: include
updated: 2026-07-08
---

# Package: md-format

`@momentarise/md-format` parses Markdown into the public MME model and serializes safely back to Markdown.

## Use It For

- AST parsing;
- source-range preservation;
- fixture round-trip checks;
- targeted Markdown edits;
- opaque syntax diagnostics.

## Import

```ts
import { createMarkdownAstFormatter } from "@momentarise/md-format";

const formatter = createMarkdownAstFormatter();
const parsed = formatter.parse("# Hello\n", { dialect: "momentarise-enhanced" });
const serialized = formatter.serialize(parsed, { preserveUnchangedRanges: true });

console.log(serialized.content);
```

## Related Docs

- [Preservation](../concepts/preservation.md)
- [Document Model](../concepts/document-model.md)
