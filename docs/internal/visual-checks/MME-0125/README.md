# MME-0125 — the React binding's formatting surface, rendered

Gate: `npm run visual:mme-0125` (`scripts/visual-check-mme0125.mjs`), `reactDemo` group.
Server: `npm run dev -w @momentarise/react-demo -- --host 127.0.0.1 --port 5175`.
URL: `http://127.0.0.1:5175/`.

Everything here is regenerated output. The committed evidence is `measurements.json`
plus this file; the PNGs are gitignored per the MME-0116 artifact policy.

## Why this gate exists

`@momentarise/md-react` is the primary documented adoption path and had **never
had a rendering proof**. The only two gates touching React consume the published
registry build, and every React test is jsdom, which has no layout. Attempt 1
shipped straight through that gap: a permanent bubble host left the rich surface
never `:empty`, so a default consumer in source mode got a transparent div
swallowing every click meant for CodeMirror — and the suite reported "all checks
passed".

`apps/react-demo` is a workspace-backed host that exists to be measured.
`examples/next-app` stays a pure registry install; its job is catching
workspace-versus-registry drift, and overlaying it would trade a permanent gate
for a one-issue convenience.

## What each artifact proves

| Artifact | Proves |
| --- | --- |
| `source-<scheme>-<width>.png` | Source mode with the rich surface fully detached — no stray border, no overlay, CodeMirror owning its own clicks. |
| `bubble-<scheme>-<width>.png` | The bubble a default React consumer gets: current block type, bold, italic, strikethrough, inline code, link. No AI entry — the binding ships no AI entry point, and offering one would be an inert control. |
| `measurements.json` | Per width: the source-mode hit test, the scrolled-anchor geometry against the painted selection, the turn-into menu's viewport containment, and the control sizes. |

## The three defects this gate was built to catch

All three were found by reading in attempt 1 and were invisible to every existing
gate. Each is now measured, and each has a mutant that reproduces it.

| Defect | Measured before the fix | After |
| --- | --- | --- |
| Rich surface painted over the source editor in source mode | a click at the source editor's centre landed on the rich host | `frameConnected: false`, `richHeight: 0`, hit lands inside the source view |
| Bubble anchored against a scroller | at `scrollTop: 900` the computed offset was a plausible `105px` while the real `top` was `-746` — 851px above the viewport | anchored to a positioned, non-scrolling frame; gap to the painted selection within 24px at every width |
| Turn-into menu opening off the bottom | at 390×844 a 422px menu opened at `y=747`, i.e. 325px past the fold | flips above when the room below cannot hold it |

The middle one is the MME-0119 defect class, and MME-0119's own rule forbids the
tempting patch: the fix is a correct containing block, never a scroll-offset
compensation.

## Reversion-to-failure table

16 mutants, 16 killed, under the MME-0125 rule now in `AGENT.md`: **the smallest
change that would still ship** — a wrong argument, a stale variable, an inverted
guard, an off-by-one, one flipped CSS property. Never a deleted call.

Browser rows run `npm run visual -- --only mme-0125`; headless rows run
`node tests/react-selection-bubble.test.mjs`. Rebuilt between every round.

| # | Reversion | Killed by (verbatim) |
| --- | --- | --- |
| N1 | frame `overflow: visible` → `auto` (one property) | `@1280: the bubble's containing block must not be a scroller, or its offsets resolve against the content origin (MME-0119 forbids compensating with the scroll offset).` |
| N2 | frame `position: relative` → `static` (one property) | `@1280: the bubble sits 56px from its selection after scrolling; it is anchored to the wrong origin.` |
| N3 | menu flip guard `roomAbove > roomBelow` → `<` | `@390: the turn-into menu left the viewport: {"bottom":1169,"height":422,"top":747,"viewportHeight":844}` |
| N4 | `richFrame.remove()` → `richHost.remove()` (wrong variable) | source-mode overlay assertions |
| N5 | opt-out `!== false` → `!== true` (inverted comparison) | `opting out must mount no bubble at all — a hidden one still carries its listeners and its session subscription` |
| N6 | `visibleCommandGroups` drops `"marks"` | `a default React consumer must get selection-bubble-bold; the binding rendered ["selection-bubble-turn-into","selection-bubble-link"]` |
| N7 | panel reset guard `!next.visible` → `next.visible` (inverted) | `an open link popover survives a re-render: a repaint closed the link popover while the writer was typing into it` |
| N8 | `rangeHasMark(from, to)` → `(from, from)` (off-by-one) | `selection-bubble-bold must report itself pressed once its mark is applied` |
| N9 | link probe reads `attrs.title` instead of `attrs.href` | `timed out waiting for: the popover to offer removal for an existing link` |
| N10 | `richView !== null` → `=== null` (inverted) | `mounting rich mode must deliver exactly one handle and no teardown; got ["null","handle"]` |
| N11 | `["strike", "mme:strikethrough"]` → `"mme:italic"` (wrong constant) | `selection-bubble-strikethrough must report itself pressed once its mark is applied` |
| N12 | `case "bullet_list"` returns `"orderedList"` (wrong constant) | `a bullet list must not report itself as a numbered list` |
| N13 | `case "todo_item"` returns `"bulletList"` (wrong constant) | `a todo must report itself as a todo, not as the list that contains it` |
| N14 | the frozen surface contract loses an entry | `the binding's declared surfaces changed; if that is intended, update this list and say why in the build log` |
| N15 | `align: "center"` → `"start"` (wrong constant) | `@1280: the bubble is 83.6px off the selection's centre with room to centre; the contract is 8px.` |
| N16 | `selectionRect` `Math.min(from.left, to.left)` → `Math.max` | `@1280: the bubble is 68.6px off the selection's centre with room to centre; the contract is 8px.` |

**Survivors, each a real finding, each repaired rather than excused.** N7, N8 and
N10 survived a first pass; the Test Reviewer's independent 39-mutant matrix then
found N11–N13 and N15–N16 on top. Nothing asserted that a panel outlives a
repaint, that each mark control reports *its own* mark, that the turn-into caption
names the right block, or that the bubble is centred at all — `horizontalOffset`
was measured into `measurements.json` and read by no assertion. Six assertions
were added; all six mutants then died.

**Recorded as equivalent rather than counted.** Two pairs cannot be killed because
the structure makes them inert, and saying so is more honest than inflating the
count: passing `richHost.getBoundingClientRect()` instead of `richFrame`'s (the
two elements occupy the same box, and the containing block is decided by CSS), and
appending `bubbleHost` to `richHost` instead of `richFrame` (the frame is detached
wholesale in source mode, and an unpositioned scroller does not clip a child whose
containing block is above it). Both were replaced with the one-property CSS
reversions N1/N2, which target the mechanism that actually prevents the defect.

**Known-inadequate, recorded rather than hidden.** `bounds` reverting to
`container` survives, because this host's frame is `height: 100%` and therefore
never taller than the viewport — the clamp is correct defensive code with no
reachable failure here. It is kept for consumers whose shell is taller, and it is
explicitly unproven.

## Behavioral parity checklist — the React binding against the reference bench

Verified in Chrome at 1280 / 768 / 390 in both schemes.

| Interaction | `apps/md-demo` (reference) | `@momentarise/md-react` | Verdict |
| --- | --- | --- | --- |
| Formatting surface exists at all | selection bubble | selection bubble, mounted by the binding | same as reference |
| Persistent toolbar | off by default | off by default (`toolbarMode: "hidden"`) | same as reference |
| Bubble contents | turn-into, B/I/S/code, link, AI | the same minus AI | **intentionally different**: the binding ships no AI entry point, so offering one would be an inert control. |
| Bubble anchoring | centered, clamped, flips below | same, via the same package helper | same as reference |
| Anchoring on a scrolled document | correct — the demo's scroller is a child of a positioned region | correct, via the rich frame | same as reference |
| Turn-into menu placement | flips above when it would overflow | same | same as reference |
| Byte exactness | apply and remove return the original bytes | same, asserted through the session | same as reference |
| Escape / outside-pointer dismissal | registered with `createSurfaceOverlayDismissController` | **not yet** — recorded as a known gap below | **intentionally different (recorded)** |
| Reposition on scroll / resize | yes | **not yet** — recorded as a known gap below | **intentionally different (recorded)** |

## Known gaps, recorded rather than implied

- **No dismissal controller.** The demo registers the bubble with
  `createSurfaceOverlayDismissController`, so Escape and outside clicks close it.
  The binding does not, so in a React host the bubble is dismissed only by
  changing the selection. Not shipped here because the controller's contract is
  host-owned and wiring it needs its own decisions about what a binding may
  dismiss on a consumer's behalf.
- **No reposition on scroll or resize.** `renderBubble` runs per transaction and
  per bubble callback. The demo also re-renders on scroll and resize. The bubble
  therefore holds a stale anchor if the document scrolls without an edit.
- Both are carried into the block's remaining surface work rather than left
  silent, and neither is a regression: before this issue the binding had no
  formatting surface at all.
