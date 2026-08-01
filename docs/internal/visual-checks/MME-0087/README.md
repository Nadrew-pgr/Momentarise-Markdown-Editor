# MME-0087 — Block handles and empty-block placeholder

Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
URL verified: `http://127.0.0.1:5174/` (the Block C launcher-prompt URL).
Capture: `npm run visual:mme-0087` → `scripts/visual-check-mme0087.mjs`
Widths: 1280 × 900 (fine pointer) and 390 × 844 (`hasTouch`, so `@media (pointer: coarse)` actually matches).

The fixture renders 11 top-level blocks: a wrapping H1, paragraph, bullet list,
ordered list, task list, blockquote, code fence, table, callout, raw-HTML block,
and a final paragraph — comfortably past the issue's "≥6 block types".

## What each screenshot proves

| File | Proves |
| --- | --- |
| `hover-single-block-1280.png` | The pointer is on "A paragraph of body text." and **only that block** shows `+` and `⠿`. Every other block is clean. Before this issue, hovering any block revealed all of them. |
| `hover-single-block-390.png` | The same document under the coarse-pointer contract, where MME-0078 keeps all affordances visible by design. |
| `placeholder-empty-block-1280.png`, `-390.png` | Pressing Enter mid-document puts the placeholder on exactly the new empty block. |

`measurements.json` records, per viewport: the hover result for **every** block
(which affordance was revealed, by declared block index), the handle-to-first-line
alignment delta per block, the fold-toggle gap and off-page flag per fold target,
the resolved gutter reservation, and the placeholder state before and after typing.

## Assertions the script enforces

- Hovering block *N* reveals exactly one affordance, and it is the one declaring
  block index *N* — checked for all 11 blocks, at fine-pointer width.
- The revealed handle is on-screen and within 24px of the block it declares —
  opacity alone is not visibility, which is how an off-page handle first passed.
- The pointer leaving the editor hides every affordance.
- Every fold toggle is measured (`measured === total`), and every block's handle
  alignment is measured (`length === blockTags.length`); a skipped element is
  exactly where a defect hides.
- Coarse pointers keep all affordances visible (MME-0078).
- Every handle is within 14px of its block's first line — centred for fine
  pointers, top-aligned for coarse (where the 44px targets stack into a column
  that cannot also be centred on one line).
- No fold toggle overlaps its block's text, and none is drawn off the page edge.
- `.ProseMirror`'s computed `padding-left` is at least the resolved
  `--mme-fold-gutter-width`, so the gutter is genuinely reserved.
- Pressing Enter yields exactly one placeholder; typing removes it; its text never
  appears in the serialized Markdown.

## Gates proven to fail before they were trusted

| Reverted fix | Gate that caught it |
| --- | --- |
| Restore `.ProseMirror:hover .rich-block-affordance` | `hovering block 0 (H1) revealed 11 of 11 affordances; exactly one block may own them` |
| Revert the caret-following placeholder | `an empty paragraph holding the caret must show the placeholder even when the document has other content` |
| Shrink the content padding below the gutter | `the content padding (2px) is narrower than the reserved fold gutter (24px)` |
| Remove `.ProseMirror { position: relative }` | `the PRE handle is 162px off its block's first line` |
| Restore the old placeholder string | `the placeholder must use the string the acceptance criteria specify` |

Four assertions were **vacuous when first written**, three of them found by the
UX reviewer rather than by me:

- the gutter check passed with the reservation removed entirely (below);
- `visibleAffordances` tested computed opacity only, so an atom block's handle at
  x = -48 — off-page and ~450px from its block — counted as "visible" and the
  per-block hover assertion passed for all 11 blocks;
- the fold-overlap loop `continue`d when a toggle had no block ancestor, silently
  dropping the one sibling-emitted toggle that was genuinely off-page (3 of 4
  measured);
- the serializer check ran against a document with no empty paragraph, no plugin
  attached and therefore no decoration, so deleting the entire placeholder
  implementation left it green.

The gutter assertion: removing the reservation
entirely still passed, because at both captured widths the centred measure left
room anyway. It now checks the reservation directly, and the mutation fails.

Two measurement bugs in my own probes are worth recording, because both would
have produced false findings:

- `selectNodeContents(block)` includes the affordance widget, which is positioned
  in the gutter — so it reported the block's text as starting at x=0 and made
  every fold toggle look like it overlapped. Text rects must come from text nodes,
  skipping `[contenteditable="false"]` subtrees.
- `.ProseMirror.children` is **not** the block list: an atom block's affordance
  and fold toggle are emitted as siblings, so they occupy child slots and shift
  every index after them. The affordance's own `data-rich-block-index` is the
  authoritative mapping.

## Behavioral parity checklist — contract 2, and the placeholder half of contract 7

| Interaction | Benchmark | MME after MME-0087 | Verdict |
| --- | --- | --- | --- |
| Hovering a block | BlockNote shows the side menu for that block only | Exactly that block's handles, verified for all 11 block types | same as benchmark |
| Hovering a different block | Handles move with the pointer | Handles move; only ever one set visible | same as benchmark |
| Pointer leaving the editor | Handles disappear | Handles disappear | same as benchmark |
| Handles on an atom block (raw HTML) | BlockNote gives every block a side menu | Handles appear beside the block, via plugin hover tracking plus explicit positioning; a CSS descendant rule could not reach them, and CSS alone positioned them off-page | same as benchmark |
| Handle alignment | Aligned to the block's first line | Within 14px of the first line's centre | same as benchmark |
| Fade | BlockNote animates the side menu in | 100ms opacity transition (`--mme-motion-fast`), inside the issue's 150ms cap | same as benchmark |
| Touch devices | Notion shows a persistent affordance | All affordances stay visible, 44px targets | intentionally different — MME-0078's coarse-pointer contract |
| Fold affordance placement | Obsidian: quiet, in a gutter, hover-revealed | Reserved `--mme-fold-gutter-width` gutter, never overlapping text at either width | same as benchmark |
| Empty focused block | Notion: "Write, press '/' for commands" | "Write, or press '/' for commands" — the string the acceptance criteria specify | same as benchmark |
| Empty block without the caret | Notion shows nothing | Nothing | same as benchmark |

## Reviewer findings fixed after the first pass

The UX reviewer measured three blockers, all real:

1. **Atom-block handles rendered off-screen.** My claim that plugin hover tracking
   made every block type work was false: the attribute was set and opacity went to
   1, but the element sat at `left: -48` with `.editor-region` as its
   `offsetParent`. `.ProseMirror` was `position: static`, so a sibling-emitted
   widget resolved against the editor shell. Fixed by making `.ProseMirror` the
   positioning context and giving sibling widgets explicit block-relative offsets
   (`positionSiblingRichBlockAffordance`, and `positionDetachedFoldToggles` for the
   demo-owned fold toggle, which had the same defect).
2. **The gate could not fail on it** — see the vacuity list above.
3. **The placeholder string was not the one the AC specifies**, and the parity
   table graded the mismatch "same as benchmark". Both corrected.

Also fixed from that review: handles vanished while typing with the pointer parked
on a block (the widget key includes the block's text, so every keystroke rebuilt
the widget DOM without the marking — now re-applied from a per-view memory on
`view.update`); hover went stale on scroll; and `mousemove` did O(blocks) DOM work
on every event (now early-returns when the hovered block has not changed).

## Known-remaining, recorded rather than fixed

- **The reported "fold arrow overlaps heading text" defect is not reproducible in
  this build.** Measured before any change: an 8px gap at 1280 and at 390, for
  both the heading and the code fence. My first probe reported three overlaps, but
  that was the `selectNodeContents` bug above. The gutter work still landed —
  reserving the space and gating it is what stops the overlap returning — but the
  honest record is that this issue hardened a contract rather than fixing a live
  defect. Worth re-checking with Andrew on the exact document that produced it.
- **Block affordances remain in the tab order for every block**, so keyboard users
  traverse two buttons per block. Notion keeps block chrome out of the tab order
  entirely. Recorded during MME-0086; still open, and larger than this issue.
- **Drag-and-drop reordering is untouched** — MME-0106 owns it.
- **No keyboard-focused-block reveal.** The AC says "the one under the pointer (or
  keyboard-focused block)"; placing the caret in a block reveals nothing, because
  `.ProseMirror > *:focus-within` can never match (ProseMirror's focus lives on
  `.ProseMirror` itself). Reported by the reviewer; not fixed here because the
  honest fix is bound up with the block-selection model MME-0103 introduces.
- **The `--mme-fold-gutter-width` reservation is currently a no-op in effect.** It
  and `--mme-content-padding-inline` both resolve to 24px, so `max()` changes
  nothing today, and below 720px a media query overrides the padding without
  consulting the token. It is a named contract with a regression gate, not a
  behavioural change — the reviewer was right to call the earlier wording
  overstated.
- **Fold chevrons are permanently visible** at 0.3 opacity rather than
  hover-revealed like the handles, so the gutter has two affordance systems with
  two reveal rules. Against the Obsidian benchmark the AC cites, they should be
  quiet and hover-revealed.
- **The drag handle renders as `::`, not a six-dot grip** — the most visible
  remaining "doesn't feel like BlockNote" detail.
- **`.rich-fold-*` classes are emitted by the demo, not by any package**, so the
  packaged fold CSS currently styles DOM a consumer never receives. The move was
  still right if the fold plugin is extracted, but the comments claiming they are
  "package-emitted decorations" overstate today's reality.
- **The placeholder survives a multi-block selection** (only the selection start is
  checked). Notion drops the hint once a selection exists.
