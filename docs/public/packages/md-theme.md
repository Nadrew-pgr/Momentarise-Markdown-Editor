---
title: "Package: md-theme"
description: Tokens, host theme contract, and icon set contract.
nav_section: Packages
nav_order: 7
audience: developers
tags:
  - package
  - theme
packages:
  - "@momentarise/md-theme"
llms: include
updated: 2026-07-08
---

# Package: md-theme

`@momentarise/md-theme` defines visual tokens and host theme contracts without tying MME to one app.

## Use It For

- default light and dark tokens;
- host theme overrides;
- icon set contracts;
- class map contracts;
- preference-aware theme resolution.

## Import

```ts
import { createDefaultTheme } from "@momentarise/md-theme";

const theme = createDefaultTheme({ colorScheme: "dark" });
console.log(theme.tokens);
```

## Related Docs

- [Theming](../concepts/theming.md)
- [Preferences](../concepts/preferences.md)
