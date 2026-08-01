# MME-0086 — Editor focus and overlay hygiene

Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
URL verified: `http://127.0.0.1:5174/` (the URL in the Block C launcher prompt). `http://localhost:5174/` was confirmed to serve the same build (HTTP 200) before capture.
Capture: `npm run visual:mme-0086` → `scripts/visual-check-mme0086.mjs`
Widths: 1280 × 900 and 390 × 844.

Every screenshot below is produced by the script, and every claim it makes is
also an assertion inside the script — the run fails rather than captures if a
claim stops holding.

## What each screenshot proves

| File | Proves |
| --- | --- |
| `focus-rich-1280.png`, `focus-rich-390.png` | A caret is placed in rich content and **no** indicator is painted around the editing surface. The script reads computed `outline-width`/`outline-style`/`box-shadow` on `.ProseMirror`, `.rich-editor-host`, `.editor-region` and `.cm-editor` and fails if any of them paints one. This is the "toute la zone d'écriture en surbrillance" defect. |
| `focus-source-1280.png`, `focus-source-390.png` | The same, with focus in the CodeMirror source surface. Live Preview is asserted in the same run (no separate capture — it shares the rich surface). |
| `code-meta-anchored-1280.png`, `code-meta-anchored-390.png` | The code language/meta editor is attached to its own code block instead of pinned to the top of the content area, sits within 24px of it, and does not overlap the block, its text, or the caret. Backed by rect arithmetic, an `elementFromPoint` hit-test on the code's first line, a caret-rect intersection test, and a scroll-tracking test. |
| `bubble-visible-1280.png`, `bubble-visible-390.png` | Selecting text raises the selection bubble. |
| `bubble-dismissed-outside-1280.png`, `bubble-dismissed-outside-390.png` | A pointer landing outside the bubble dismisses it — the stale-overlay defect. |
| `keyboard-focus-control-1280.png`, `keyboard-focus-control-390.png` | Removing the surface ring did not remove keyboard focus. The script focuses a **named roster** — `code-language-input`, `code-meta-input`, `insert-after-block-button`, and two block affordance buttons — and fails if any is missing, cannot take focus, does not match `:focus-visible`, or draws less than a 2px outline (WCAG 2.4.7). |

`measurements.json` records the computed focus treatment per mode and viewport,
the anchoring geometry, the full dismissal matrix, and every keyboard-focused
control observed.

## Dismissal matrix asserted in the browser

| Overlay | outside pointer | Escape | blur | mode switch |
| --- | --- | --- | --- | --- |
| Selection bubble | asserted | asserted | via controller | asserted |
| Slash menu | via controller | asserted | via controller | asserted |
| Block menu | asserted | via controller | via controller | asserted |
| Code language/meta editor | via controller | via controller | asserted | asserted |

"via controller" means the path is proven at unit level in
`tests/rich-overlay-hygiene.test.mjs` against the shared
`createSurfaceOverlayDismissController`, which is the single mechanism all four
overlays are registered with; the browser run additionally proves each overlay's
registration end-to-end for at least one reason, plus all four for mode switch.

## Behavioral parity checklist — contract 3 (focus/selection) and the overlay half of contracts 4 and 6

| Interaction | Benchmark | MME after MME-0086 | Verdict |
| --- | --- | --- | --- |
| Placing a caret in the document | Notion/Obsidian/BlockNote paint nothing around the editor; the caret carries focus | No outline or box-shadow on any editing surface, in rich, source, or Live Preview | same as benchmark |
| Keyboard focus on a control inside the document | Ring on the control only | `:focus-visible` ring on the control only, ≥2px, asserted per control against a named roster | same as benchmark |
| Clicking outside an open selection bubble | Bubble disappears | Bubble disappears | same as benchmark |
| `Escape` with an overlay open | Overlay closes, caret returns to the document | Overlay closes; `returnFocus` hands the caret back when the overlay held focus, asserted in the browser | same as benchmark |
| Focus leaving the editor entirely | Overlays disappear | Overlays disappear | same as benchmark |
| Switching editing mode | Overlays disappear | All four disappear | same as benchmark |
| Pointer inside an open overlay | Overlay survives (you can click its buttons) | Overlay survives | same as benchmark |
| Focus moving into an overlay | Overlay survives | Overlay survives | same as benchmark |
| Moving the caret to another block and back | Notion re-shows the new block's controls | Controls follow the caret; asserted with real mouse clicks | same as benchmark |
| Selecting text inside a block that has controls | Selection bubble owns the moment | Block controls yield to the bubble; never both at once | same as benchmark |
| Scrolling the document with controls open | Controls travel with their block | Controls track the block (±2px) and hide when it leaves the viewport | same as benchmark |
| Code block's language control position | Notion/BlockNote: at the block's own corner, hover-revealed into reserved padding, never over code | Floating below the block, right-aligned; never overlaps the block's own text or caret | intentionally different — the reserved-padding corner needs the smaller control set MME-0105 introduces. Placing it *over* the block was tried and rejected: it covered the code and the caret, which since this issue is the surface's only focus indicator. |
| Code block's language control content | Notion/BlockNote: language dropdown + copy button | Text fields for language and meta, plus "Add paragraph" | intentionally different — MME-0105 owns the corner-control redesign (dropdown, copy). MME-0086 owns only where it is anchored. |
| Code block controls at 390px | Notion collapses to a compact control | Wraps to two rows, clamps inside the viewport, 44px touch targets | intentionally different — accepted until MME-0105 shrinks the control set |
| Block taller than the viewport | Notion keeps the control pinned inside the block's chrome | The controls hide: neither side of the block has room, and placing them anywhere inside would cover the block's own text and the caret | intentionally different — hiding is the safe choice; reaching the controls needs a scroll to the fence's end. MME-0105's in-block chrome removes the constraint. |
| Reaching the controls by keyboard | Notion: block chrome is not in the tab order at all | Forward Tab reaches them in visual order, but only after every block's affordance buttons (10 stops in the short fixture) | intentionally different for now — the affordances being permanently tabbable is MME-0087's to fix; `measurements.json` records the stop count |

## Gates proven to fail before they were trusted

Every assertion below was mutation-tested: the fix was reverted, the gate was
confirmed to fail with the expected message, and the fix restored.

| Reverted fix | Gate that caught it |
| --- | --- |
| Reinstate `.rich-editor-host:focus-within` | `rich-overlay-hygiene` static check **and** the browser focus check |
| Re-pin the block controls to the content top | `the code-meta editor must sit within 24px of its block` |
| Place the controls over their own block | same assertion, `gap=-79` |
| Ignore `fits` and clamp to the bounds edge | `in a fence taller than the viewport the controls were parked inside the block (controls 728–832, block 131–1458)` |
| Revert the `NodeSelection` lookup | `selecting a code block as an object must show its language/meta controls` |
| Remove the caret-move latch clear | `the block controls must reappear when the caret is clicked back into the code block` |
| Remove the scroll listener | `the controls did not follow their block on scroll (block moved -120px, controls moved 0px)` |
| Move the controls host before the editor | `the block-controls host precedes the editing surface in document order` |
| Remove `returnFocus` | `Escape inside the block controls stranded focus on BODY` |
| Remove the packaged `[hidden]` guard | `the packaged [hidden] rule must win against author display declarations` |

**Four of these assertions were vacuous when first written** and only the mutation
test revealed it. Recorded because the pattern is the point, not the individual
bugs:

- the follows-caret check used the programmatic selection API, so it never fired
  the pointer event that caused the bug — it passed against broken code;
- the scroll check ran against a document too short to scroll;
- the keyboard-focus check collected whatever forward-Tab reached and asserted
  only on controls that already matched `:focus-visible`, so a control with no
  ring was filtered out rather than failed — its recorded evidence was 24 block
  affordance buttons and not one control this issue introduced;
- the tall-fence check first measured caret coverage at a caret position that
  happened to sit clear of the clamped overlay.

Each now carries an explicit guard against its own vacuity: real
`page.mouse.click`; an assertion that the block actually moved more than 50px; a
named roster that fails on a missing or ring-less control; an assertion that the
caret is within 160px of the viewport bottom, plus a structural block-overlap
check that does not depend on where the caret lands.

## Known-remaining, recorded rather than fixed

- **The block menu (`.rich-block-menu`) is still demo-owned markup.** Its dismissal now comes from the packaged controller, so a consumer gets that behaviour, but the menu itself is composed by the host. No issue currently owns moving it; flagged for MME-0105/MME-0109.
- **`.rich-fold-toggle` focus styling is still demo-only** and uses a bare `:focus` (a ring on pointer click). Deliberately left alone: MME-0087 owns the fold gutter and will move it into the packaged stylesheet.
- **The controls cover the top of the block *after* the code fence**, at both widths — measured and recorded in `measurements.json` (`*-neighbour`), deliberately *not* asserted as a failure. Every floating placement has a victim: above covers the previous block, over the block covers its own text and the caret, below covers the next one. The benchmark answer is for the block to reserve space for its own chrome, which was implemented and then removed: the block DOM belongs to ProseMirror, and a host-set attribute is discarded the moment the node re-renders (verified with a MutationObserver — the attribute is set, then the `<pre>` is rebuilt without it). Doing it properly needs a ProseMirror decoration, which belongs with MME-0105's in-block chrome redesign.
- **Block affordance buttons are permanently in the tab order**, so reaching the block controls by keyboard costs ~10 Tab stops in a short document and far more in a long one. Notion keeps block chrome out of the tab order entirely. MME-0087 owns making the affordances hover-scoped.
- **Non-text contrast of the input boundaries is ~1.27:1 against a 3:1 requirement** (WCAG 1.4.11), in both schemes. Pre-existing and cross-cutting — the same `--mme-color-border` serves the command palette and find/replace, and no ramp step below `--mme-neutral-10` reaches 3:1 on white. Recorded in `docs/internal/BACKLOG.md`; `tests/theme-contrast.test.mjs` checks text pairs only and is structurally blind to it.
- **`dismiss("escape")` closes every open overlay, not the topmost.** Correct today because no two of the four can be open together, but it is not the benchmark's layered-Escape behaviour.
