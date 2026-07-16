---
title: Theme System
description: Tokens, host theme objects, icons, and class maps.
nav_section: Styling
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

# Theme System

`@momentarise/md-theme` defines visual tokens and host theme contracts without tying MME to one app.

## Use It For

- default light and dark tokens;
- host theme overrides;
- icon set contracts;
- class map contracts;
- preference-aware theme resolution.

## Import

```ts
import { resolveTheme, resolveThemeToCssVariables } from "@momentarise/md-theme";

const theme = resolveTheme({}, "dark");
const cssVariables = resolveThemeToCssVariables({}, "dark");

console.log(theme.colors.bg, cssVariables["--mme-color-bg"]);
```

## Related Docs

- [Theming](../concepts/theming.md)
- [Preferences](../concepts/preferences.md)
