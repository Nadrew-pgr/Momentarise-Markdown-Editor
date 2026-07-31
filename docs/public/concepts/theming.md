---
title: Theming
description: Theme MME through tokens, host theme objects, icons, and class maps.
nav_section: Styling
nav_order: 6
audience: developers
tags:
  - theming
  - customization
packages:
  - "@momentarise/md-theme"
llms: include
updated: 2026-07-31
---

# Theming

MME separates framework tokens from host styling.

## Component Stylesheet

`@momentarise/md-theme` ships the visual design for every editor surface (source view, rich content, toolbar, selection bubble, slash menu, block handles, tables, callouts, code, footnotes, task lists, status and mode controls) as a plain, importable stylesheet. Import it once and the editor looks like the reference demo instead of unstyled browser controls. It also pulls in the token layer, so this single import is all you need.

Vanilla / any bundler:

```css
@import "@momentarise/md-theme/styles.css";
```

React or Next.js (from a client component or your global stylesheet):

```ts
import "@momentarise/md-theme/styles.css";
```

Framework-free `<link>`:

```html
<link rel="stylesheet" href="/node_modules/@momentarise/md-theme/src/styles.css" />
```

The stylesheet is ESM/bundler-friendly and requires no build step. Every rule consumes `--mme-*` tokens, so you restyle by overriding tokens — not by patching selectors.

### Light and dark

Colors default to the visitor's `prefers-color-scheme`. Pin a scheme explicitly on any ancestor (usually `<html>`):

```html
<html data-mme-scheme="dark">
```

`data-mme-scheme="light"` and `data-mme-scheme="dark"` always win over the media default.

## The Design System

MME's look is a formal system, not a pile of values. Every padding, radius, duration, and font size in the packaged stylesheet spends one of the ladders below — a rule that is enforced in CI, so the system cannot erode.

### Typography

Two roles. Content is document-grade; UI is compact and exact.

| Token | Value | Use |
| --- | --- | --- |
| `--mme-font-size-content` | `16px` | document text |
| `--mme-font-size-ui` | `13px` | buttons, menu items, inputs |
| `--mme-font-size-ui-sm` | `12px` | secondary UI text |
| `--mme-font-size-ui-xs` | `11px` | uppercase labels only (with `--mme-letter-spacing-label`) |
| `--mme-font-size-code` | `14px` | source view and code blocks |
| `--mme-line-height-content` | `1.65` | document text |
| `--mme-line-height-ui` | `1.45` | chrome |
| `--mme-line-height-heading` | `1.25` | headings |
| `--mme-line-height-code` | `1.55` | mono |

Nothing renders below 11px, anywhere.

Font roles split into `--mme-font-family-content`, `--mme-font-family-ui`, and `--mme-font-family-mono`. Weights are `--mme-font-weight-regular|medium|semibold|bold` (400/500/600/700).

The content heading scale is expressed in `em`, so it tracks the content size:

| Level | Size | Weight | Tracking | Margin top |
| --- | --- | --- | --- | --- |
| H1 | `1.875em` | 700 | `-0.021em` | `2em` |
| H2 | `1.5em` | 600 | `-0.017em` | `1.75em` |
| H3 | `1.25em` | 600 | `-0.012em` | `1.5em` |
| H4 | `1.125em` | 600 | — | `1.5em` |
| H5 | `1em` | 600 | — | `1.5em` |
| H6 | `0.875em` | 600, muted | — | `1.5em` |

All headings share `--mme-heading-margin-bottom: 0.5em`, and the document's first block never pushes the page down.

Block rhythm: `--mme-block-gap` (`0.625em`) between paragraphs and list blocks, `--mme-list-item-gap` (`0.25em`) between list items, `--mme-block-gap-lg` (`1em`) around blockquotes, callouts, tables, and code.

### Spacing ladder

One ladder, thirteen steps. Nothing between them.

| Token | `2xs` | `xs` | `sm` | `md` | `lg` | `xl` | `2xl` | `3xl` | `4xl` | `5xl` | `6xl` | `7xl` | `8xl` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `--mme-space-*` | 2 | 4 | 6 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 |

The content measure is `--mme-content-measure: 708px`, with `--mme-content-padding-block-start: 64px` on desktop and `--mme-content-padding-inline: 24px`.

### Radius, elevation, motion

`--mme-radius-xs|sm|md|lg|xl` = 4 / 6 / 8 / 10 / 12px, plus `--mme-radius-full` (`999px`). No other radii.

`--mme-elevation-1|2|3` are the only three shadows. Level 1 is a resting control, level 2 the selection bubble, level 3 every popover and menu. Dark mode keeps the same geometry with deeper alphas and a 1px inner border.

`--mme-motion-fast|base|slow` = 100 / 150 / 200ms with `--mme-motion-ease: cubic-bezier(0.2, 0, 0, 1)`. Overlays enter with opacity plus a 0.98→1 scale from their anchor; hovers transition color, background, and border only. **The typing path carries zero animation**, and `prefers-reduced-motion: reduce` disables all of it.

### Chrome geometry

`--mme-control-height` (`28px`), `--mme-control-padding-inline` (`10px`), `--mme-topbar-height` (`48px`), `--mme-menu-item-height` (`32px`), `--mme-bubble-height` (`32px`), `--mme-icon-size` (`16px`), and `--mme-touch-target-size` (`44px`, applied under `pointer: coarse`).

### Color: ramps and semantic aliases

Colors are two 12-step ramps per scheme — `--mme-neutral-1..12` and `--mme-accent-1..12` — using Radix step semantics: **1-2 backgrounds, 3-5 interactive surfaces, 6-8 borders, 9-10 solid, 11-12 text**.

Every semantic token is an alias into a ramp step:

| Alias | Reads |
| --- | --- |
| `--mme-color-bg` | neutral 1 |
| `--mme-color-surface` | neutral 2 |
| `--mme-color-surface-raised` | neutral 2 (light) / neutral 4 (dark) |
| `--mme-color-surface-muted` | neutral 3 |
| `--mme-color-surface-hover` | neutral 3 (light) / neutral 5 (dark) |
| `--mme-color-surface-active` | neutral 4 (light) / neutral 6 (dark) |
| `--mme-color-code-bg` | neutral 4 (light) / neutral 3 (dark) |
| `--mme-color-border-subtle`, `--mme-color-border` | neutral 6 |
| `--mme-color-border-strong` | neutral 7 |
| `--mme-color-text` | neutral 12 |
| `--mme-color-text-muted` | neutral 11 |
| `--mme-color-text-subtle` | neutral 10 (light) / neutral 9 (dark) |
| `--mme-color-accent` | accent 9 |
| `--mme-color-accent-hover` | accent 10 |
| `--mme-color-accent-text` | accent 11 |
| `--mme-color-accent-soft` / `-softer` | accent 3 / accent 2 |

Light and dark map a few aliases to different steps on purpose: elevation runs in opposite directions, so a raised surface is *lighter* than the canvas in dark and white-on-tinted in light.

Use `--mme-color-accent` for accent *fills* and `--mme-color-accent-text` for accent *text* — step 11 is the one that meets the text contrast floor in both schemes.

**Accent scarcity.** Accent color appears only on the primary action, the active mode, links, selection, focus, and checked todos. It is never decorative chrome. If you are reaching for accent to make something noticeable, reach for a border or a surface step instead.

**Contrast floors**, machine-checked in both schemes: primary text ≥ 7:1, secondary ≥ 4.6:1, muted and disabled ≥ 3:1.

### Density

`--mme-density` scales control heights and padding: `1` is comfortable (default), `0.875` is compact. It does not touch content typography — a denser toolbar should not shrink the document.

```css
:root {
  --mme-density: 0.875;
}
```

## Restyle in 5 minutes

A rebrand is a ramp swap. Override the 12 accent steps (and the neutrals if you want a different paper), and every surface follows — no selector is touched:

```css
@import "@momentarise/md-theme/styles.css";

:root[data-mme-scheme="light"] {
  --mme-accent-1: #fff6f5;
  --mme-accent-2: #ffe9e6;
  --mme-accent-3: #ffd9d4;
  --mme-accent-4: #ffc4bd;
  --mme-accent-5: #ffaaa1;
  --mme-accent-6: #f88b80;
  --mme-accent-7: #e96a5e;
  --mme-accent-8: #d24a3f;
  --mme-accent-9: #b3271c; /* solid: primary buttons, checked todos */
  --mme-accent-10: #9a1f16; /* solid hover */
  --mme-accent-11: #a82219; /* accent text: links, active mode */
  --mme-accent-12: #4a1009;

  --mme-color-focus-ring: #b3271c;
  --mme-color-selection: rgba(179, 39, 28, 0.16);
}
```

Check your ramp against the contrast floors above — steps 11 and 12 carry text, so they are the ones that matter.

If you only need to nudge one thing, override the semantic alias instead of the ramp:

```css
:root {
  --mme-radius-sm: 2px; /* squarer controls */
  --mme-font-family-content: "Iowan Old Style", Georgia, serif;
}
```

Typed hosts can do the same through `resolveThemeToCssVariables` from `@momentarise/md-theme`, which accepts a partial `ramps` override and derives every semantic color from it (`deriveColorsFromRamps` is exported if you want the mapping directly).

## Machine-readable tokens

The whole system ships as JSON for tools and agents — every token with its name, raw value, fully resolved value, role, and scheme, plus the ladders and the rules above:

```ts
import tokens from "@momentarise/md-theme/tokens.json" with { type: "json" };

tokens.schemes.dark["--mme-color-surface-raised"];
// { name, value: "var(--mme-neutral-4)", resolved: "#1a1c22", role: "color.semantic" }
```

It is generated from `tokens.css`, so it can never drift. A mirror lives at `docs/agent/tokens.json`.

## Host Control

The host decides whether settings are global, workspace-level, document-level, user-level, or locked.

MME does not require a built-in settings screen.

## Related Docs

- [Preferences](preferences.md)
- [Theme System](../packages/md-theme.md)
- [Surface Components](../packages/md-surface.md)
