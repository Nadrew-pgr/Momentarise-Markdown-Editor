# MME-0123 — mount fidelity (visual proof)

Gate: `npm run visual:mme-0123` (or `npm run visual -- --only mme-0123`).
Script: `scripts/visual-check-mme0123.mjs`. Server: the demo, `MME_DEMO_URL`.

## What the defect looked like

The document loaded into every run is:

```text
Intro paragraph.

alpha␠␠
bravo

Outro paragraph.
```

The two spaces after `alpha` are the hard-break syntax. They are invisible in
any screenshot, which is exactly why this gate asserts **bytes** and **DOM
structure** rather than pixels.

Before this issue the rich mounter tested for the node type `"break"` while the
parser emitted `"lineBreak"`, so the second paragraph mounted as the single
merged text `alphabravo` — and the first edit to it wrote `**alphabravo**` back
to disk. One of the writer's two lines, gone, with no warning anywhere.

## What each artifact proves

| Artifact | Proves |
| --- | --- |
| `measurements.json` | Per viewport and per row: the mounted block (`brCount`, text), the exact bytes the Save Engine wrote to the writable handle, and the reopened block. This file is the evidence; the screenshots are context. |
| `mount-fidelity-1280.png` | Desktop dark, after the last row: the soft-broken paragraph renders as two lines. |
| `mount-fidelity-390.png` | Coarse-pointer width, driven through the selection bubble rather than the sticky toolbar (see the bubble/toolbar overlap recorded in `BACKLOG.md`). |
| `mount-fidelity-1280-light.png` | Light scheme, same assertions. |

## The three rows

1. **`neighbour-untouched`** — bold the *first* paragraph and save. The
   soft-broken paragraph is untouched, so its bytes must come back identical,
   trailing spaces included. This is the acceptance criterion's browser proof.
2. **`break-survives-its-own-edit`** — bold the soft-broken paragraph itself and
   save. Expected `**alpha␠␠\nbravo**`; the defect wrote `**alphabravo**`. The
   reopened block must hold exactly one `<strong>` **containing** a real `<br>`
   (`strong br`, not one of each), which proves the line survived the *mount*
   rather than merely surviving a replay of untouched source bytes — and, as the
   same assertion, that the break kept the marks the model gave it. Without the
   break's marks this reopens as `<strong>alpha</strong><br><strong>bravo</strong>`.
3. **`run-ending-on-the-break`** — `Home`, then `Shift+ArrowDown`: the first
   visual line plus the hard break. Bold, save. Expected `**alpha**␠␠\nbravo`.
   A mark run that *ends* on a break puts its closing `**` after the break's
   trailing spaces, where CommonMark stops reading it as a delimiter, so the
   file gets `**alpha␠␠\n**bravo` — two literal asterisks and no bold at all.
   Found by this issue's Test Reviewer. It was unreachable before MME-0123
   (no break in the document meant no selection could straddle one), so the fix
   that restored the break is the change that owed this guard. The row asserts
   the selected text first: without that it could pass while bolding a different
   range.

Rows 2 and 3 are the ones that matter. Byte identity for an unedited document
passed throughout the defect's entire life, because targeted serialization
replays untouched blocks from their source ranges and never consults the
mounted view.

## Reversion-to-failure

Both halves of the gate were observed to fail before being trusted. The full
table, including the unit-suite mutants, is in this issue's `build-log.md`
entry; the two that this script kills on its own:

| Reverted | Gate assertion that failed |
| --- | --- |
| `isMomentariseLineBreakNode(node)` → `node.type === "break"` at the mount | `@1280 neighbour-untouched: the soft-broken paragraph must mount with a real <br>` — actual `<p>alphabravo</p>`, `0 !== 1` |
| the line-break case in `md-format` emitting `"\n"` instead of `"  \n"` | `@1280 break-survives-its-own-edit: the saved file must keep every line` — actual `**alpha\nbravo**` |
| the trailing-`hard_break` trim in `selectInlineRun` | `@1280 run-ending-on-the-break: the saved file must keep every line` — actual `**alpha  \n**bravo` |
