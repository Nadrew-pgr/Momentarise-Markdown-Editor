---
title: "Package: md-cli"
description: Command line contracts for MME.
nav_section: Packages
nav_order: 16
audience: developers
tags:
  - package
  - cli
packages:
  - "@momentarise/md-cli"
llms: include
updated: 2026-07-08
---

# Package: md-cli

`@momentarise/md-cli` gives developers and agents a command-line surface for MME checks.

## Use It For

- initializing integration scaffolds;
- checking fixture and parser health;
- inspecting Markdown files;
- formatting dry runs and explicit writes;
- machine-readable `--json` output.

## Example

```bash
node packages/md-cli/dist/index.js inspect README.md --json
```

## Security

The CLI resolves Document Access Policy before reading, exporting, or writing files. It denies symlink escapes and policy-denied paths.

## Related Docs

- [Document Access Policy](../concepts/policy.md)
- [Compatibility Promise](../compatibility-promise.md)
