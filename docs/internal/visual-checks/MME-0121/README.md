# MME-0121 — visual verification

**Gate:** `npm run visual:mme-0121` (`scripts/visual-check-mme0121.mjs`).
**Dev server:** `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
(started from `.claude/launch.json`). **URL:** `http://127.0.0.1:5174/`.

## What this gate proves that the unit suite cannot

`tests/rich-mark-runs.test.mjs` drives `applyRichMarkdownCommand` directly.
This gate walks the writer's own path end to end: a real keyboard selection
(`Home`, `Shift+End`), a real press on the formatting control, a real save
through a writable file handle, and a reload of the saved bytes.

The defect's signature was plausible-looking bytes — ``**a ****`x`**** b**`` —
that re-opened as strong nested inside strong. So each row asserts the disk
bytes AND the re-opened DOM: **exactly one** outer `<strong>`/`<em>` in the
paragraph, with the inner construct still alive inside it.

## Rows

| id | source | pressed | bytes on disk | reopened DOM |
| --- | --- | --- | --- | --- |
| `bold-across-code` | `` a `x` b `` | Bold | ``**a `x` b**`` | one `<strong>`, `<code>` inside it |
| `italic-across-bold` | `a **b** c` | Italic | `*a **b** c*` | one `<em>`, `<strong>` inside it |

## Each viewport uses the surface a writer actually touches there

- **1280 / 1280-light:** a real `click()` on the sticky toolbar's
  `toolbar-command-bold` / `toolbar-command-italic`.
- **390 (touch):** a real `tap()` on the selection bubble's
  `selection-bubble-bold` / `selection-bubble-italic`. Measured while building
  the gate: at this width the selection bubble floats over the sticky toolbar
  (bubble 48..240 × 127..181 vs bold button 116..160 × 108..152), and the
  bubble's padding swallows a tap aimed at the covered toolbar button — so the
  bubble is not merely the convenient path, it is the only one that works
  where the overlap occurs. Pre-existing layout behaviour, recorded in
  BACKLOG.md; this issue changed serialization only.

## Screenshots

- `mark-runs-1280.png`, `mark-runs-390.png`, `mark-runs-1280-light.png` — the
  editor after the second row's reload: the italic run rendered as one `<em>`
  containing `<strong>`. The document state is asserted before the screenshot,
  so the image cannot show something other than what this file claims.

## The gate was mutation-tested

Per the repository rule (gates have shipped green while checking nothing), the
fix was reverted underneath the gate:

| Reversion | Gate failure |
| --- | --- |
| per-node wrapping restored | `@1280 bold-across-code: the file must hold one delimiter pair per run, got "**a ****`x`**** b**\n"` |

## Human review

Not required by the issue. `measurements.json` carries every measured value,
including the bytes each row wrote to disk and the reopened DOM facts.
