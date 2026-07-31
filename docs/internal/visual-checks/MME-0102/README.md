# MME-0102 — Design foundation: premium by default

Artifacts for the design-system issue.

> **This file was destroyed once.** `scripts/visual-check-mme0102.mjs` originally
> began with `rm -rf` on this whole folder, so a re-run silently deleted this README
> and the `registry/` proof between writing them and committing. The script now
> clears only the artifacts it owns (see `clearOwnArtifacts`). If you add a
> hand-written file here, it is safe.

## Regenerating

Demo capture — start the demo first:

```bash
npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174
```

```bash
npm run visual:mme-0102
```

Registry-parity capture — needs `examples/next-app` installed **purely from the
registry** (no workspace overlays) and running:

```bash
cd examples/next-app && npm install && npm run dev -- --hostname 127.0.0.1 --port 5179
```

```bash
npm run visual:mme-0102-registry
```

Both scripts **assert** their geometry. A drifting value fails the run instead of
quietly producing a wrong-looking screenshot.

## Benchmark boundary

Notion, Linear, Vercel, and BlockNote are used as **visual reference only**. No
assets, CSS, markup, or screenshots were copied from any of them. The comparison
below is between their published, observable geometry and the numbers MME actually
renders — the math is imitated, nothing else. Every image in this folder is MME's
own output.

## What each artifact proves

`<name>-<scheme>-<width>.png` at 1280 / 768 / 390 in `dark` and `light` — 24 files.

| Artifact | Benchmark | What it proves |
| --- | --- | --- |
| `content-*` | Notion document typography | 16px content text at 1.65, the em heading scale with negative tracking, the 708px measure, 64px of top breathing room. The document title wraps rather than truncating at 390. |
| `content-blocks-*` | Notion block rhythm | Table, code block, blockquote, footnote definition under one rhythm (0.625em between text blocks, 1em around heavy blocks). |
| `menu-*` | BlockNote menus | Slash menu at 10px radius, 6px container padding, 6px item radius, 11px uppercase group labels, hairline group separators, three-layer elevation-3, and descriptions that **wrap rather than truncate**. |
| `source-*` | Vercel/Linear code surfaces | CodeMirror at 14px mono / 1.55 with the gutter attached to the centred text column. |
| `registry/*` | — | What a stranger gets from `npm install`: the styled editor, a real chrome bar, and a rich-mode edit round-tripping into Markdown. |
| `measurements.json` | all | The computed values behind the table below, captured from the running demo. |

## Measured against the benchmarks

Captured at 1280; identical in both schemes.

| Property | Benchmark target | MME measured | |
| --- | --- | --- | --- |
| Content font size | Notion 16px | `16px` | ✅ |
| Content line height | Notion ~1.5–1.65 | `1.65` | ✅ |
| Content measure | Notion 708px | `708px` | ✅ |
| Content padding-top (desktop) | generous | `64px` | ✅ |
| H1 / H2 / H3 | a real scale | `30` / `24` / `20px` (1.875 / 1.5 / 1.25em) | ✅ |
| H1 weight, tracking | tightens with size | `700`, `-0.63px` (−0.021em) | ✅ |
| Control height | Linear/Vercel 28px | `28px` | ✅ |
| Control radius | Linear/Vercel 6px | `6px` | ✅ |
| Top bar height | Linear 48px | `48px` | ✅ |
| Chrome separator | hairline | `1px` | ✅ |
| Menu radius | BlockNote ~10px | `10px` | ✅ |
| Menu container padding | BlockNote 6px | `6px` | ✅ |
| Menu item radius | BlockNote 6px | `6px` | ✅ |
| Menu item height | 32px **floor** | `46px` — see deviation below | ⚠️ |
| Menu elevation | layered, quiet | 3 shadow layers (elevation-3) | ✅ |
| Smallest rendered text | ≥ 11px | `11px` | ✅ |

Contrast floors (primary ≥ 7:1, secondary ≥ 4.6:1, muted/disabled ≥ 3:1) are proven
continuously by `tests/theme-contrast.test.mjs`, which resolves `tokens.css` for both
schemes rather than sampling pixels.

### Recorded deviation — menu item height

`--mme-menu-item-height: 32px` is a **minimum**, not a fixed height. Slash-menu items
carry a title plus a wrapping description, so content sets the real height (46px for a
one-line description, more when it wraps). The token is applied as `min-height`. This
is deliberate: truncating the description to hit 32px was the previous behaviour and it
read as cheap. A future single-line menu (e.g. the More menu) sits at the 32px floor.

## Known limitations, not fixed here

- **Slash-menu icons repeat.** "Toggle block", the four row operations, and several
  others fall back to a chain-link glyph, and "Paragraph"/"Heading 1" both render an
  "H". This is an icon-mapping gap in `md-surface`'s `slashIconName`, not a design-token
  problem; it predates this issue. It is the most visible remaining flaw on the menu
  surface and deserves its own issue in Block C/D.
- **Demo page-shell responsiveness.** At 768 and 390 the demo's top bar drops controls
  (including Save and the mode switch) rather than collapsing into an overflow menu, and
  the "TECHNICAL DIAGNOSTICS" pill overlaps document text. Both are `apps/md-demo`
  page-shell concerns, outside the packaged stylesheet this issue owns.
- **Non-text contrast.** Interactive borders (inputs, unchecked todo checkboxes) sit at
  1.2–1.5:1 against their background — below WCAG 1.4.11's 3:1 for non-text UI. The
  issue's stated floors cover text only, so raising the border ramp step is recorded as
  a follow-up rather than changed under this issue.
- **Light elevation reads weaker than dark**, because dark adds an inner `border-strong`
  ring. Not failing, but the schemes are not at parity.

## Human review

Andrew approves the look — that judgment, not these tests, is the exit gate for Block B3.
