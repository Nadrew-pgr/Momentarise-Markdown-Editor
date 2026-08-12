# MME-0089 — selection bubble toolbar expansion

Gate: `npm run visual:mme-0089` (`scripts/visual-check-mme0089.mjs`), demo group.
Server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`.
URL: `http://127.0.0.1:5174/`.

Everything here is regenerated output. The committed evidence is `measurements.json`
plus this file; the PNGs are gitignored per the MME-0116 artifact policy.

## What each artifact proves

| Artifact | Proves |
| --- | --- |
| `bubble-<scheme>-<width>.png` | The bubble as a writer sees it: turn-into (showing the current block type), separator, B / I / S / code, separator, link, AI — and no persistent toolbar anywhere in the header. |
| `turn-into-<scheme>-<width>.png` | The block-conversion dropdown anchored under its own control, the current block type checked, unavailable conversions dimmed. |
| `link-<scheme>-<width>.png` | The link popover taking the bubble's place in situ rather than floating beside it. |
| `measurements.json` | Every geometric and byte assertion the gate made, per width: toolbar state before and after the host opt-in, the bubble's rect against the painted selection rect, centering offset or the clamp that replaced it, overflow, and the coarse-pointer sizes. |

## Behavioral parity checklist — benchmark contract 4

Verified in Chrome at 1280 / 768 / 390 in both schemes by the gate above, not on
paper. Reference: `docs/internal/research/editor-ux-benchmark.md`.

| Interaction | Notion / BlockNote | MME after this issue | Verdict |
| --- | --- | --- | --- |
| Persistent formatting toolbar | none; formatting lives in the selection bubble and slash menu | none by default; `toolbar.mode` resolves to `hidden` with no host layer | same as benchmark |
| Host that wants a Google-Docs toolbar | BlockNote exposes the formatting toolbar as a component a host may place | `toolbar.mode: "sticky" \| "floating" \| "inline"` opt-in, proven live in the same gate | same as benchmark |
| Bubble appears on selection | on highlight | on a non-empty text selection | same as benchmark |
| Bubble position | centered above the selection, flipping below when clipped | centered within 8px, or clamped to the region margin while still overlapping its selection; flips below near the top | same as benchmark |
| Bubble hides while typing | yes | yes — the first keystroke collapses the selection and the affordance goes | same as benchmark |
| Bubble hidden where inline marks cannot apply | BlockNote hides it for blocks without inline content | refused inside code blocks and opaque/raw blocks, via the package's `richSelectionSupportsFormatting` | same as benchmark |
| Turn-into dropdown | paragraph, headings, lists, quote, code | the same nine, with the current type checked | same as benchmark |
| Turn-into inside a list item | Notion converts a list item to any block | control disabled, with a reason in its tooltip — no block command can lift a list item out of its list yet | **intentionally different (recorded)**: shipping an enabled control that silently does nothing is the inert-control failure. MME-0105 owns the conversion; the gate pins the disabled state so that issue must revisit this row. |
| Turn-into reports the current block | Notion shows the block type on the control | shown as caption and as the first words of the accessible name; the menu marks it with `menuitemradio` + `aria-checked` | same as benchmark |
| Keyboard operation of the bubble | BlockNote's toolbar is a single tab stop with arrow-key traversal | single tab stop, arrow traversal, focus preserved across re-renders, focus kept in the bubble when an action is run from the keyboard | same as benchmark |
| Turn-into dropdown by keyboard | APG menu-button: focus enters on open, Up/Down/Home/End, focus returns to the trigger on close | implemented | same as benchmark |
| Link destinations | Notion accepts `example.com` and normalises it | relative (`./notes.md`), anchor (`#section`) and scheme-less destinations all accepted — constraint validation is off | **better**: Markdown is the real source here, so a relative path is the common case, not the exception. |
| Typing a destination survives a repaint | — | the in-progress value and the caret survive scroll, resize, and editor transactions; the panel is not dismissed by a repaint | **better**: measured defect, not a benchmark row — on a phone the on-screen keyboard's `resize` used to wipe the field. |
| Bold / italic / strikethrough / inline code | four marks | the same four, each byte-exact on apply and on removal | same as benchmark |
| Link | `Cmd/Ctrl+K` on a selection opens a URL field | same; with no selection `Mod-k` still opens the command palette | same as benchmark |
| Link editing | popover replaces the toolbar contents | same, in place, so the bubble keeps its anchoring | same as benchmark |
| Removing a link | destination cleared from the popover | explicit Remove action; document returns to its original bytes | same as benchmark |
| AI entry from a selection | BlockNote ships an AI entry in the formatting toolbar | present and gated on the `selection` entry point | same as benchmark |
| Clicking a bubble control keeps the selection | yes | yes — `mousedown` is cancelled inside the bubble so focus never leaves the document | same as benchmark |
| Escape | closes the affordance | closes an open sub-panel first, then the bubble | **better**: one layer at a time, so a mistyped URL does not cost the selection. |
| Icon per turn-into entry | BlockNote gives each block type its own icon | paragraph, H1, H2, H3 and numbered list each gained their own glyph in `md-theme` | same as benchmark. The slash menu's wider icon-mapping gap remains MME-0105's scope; this issue fixed only the glyphs its own control depends on, because at 390px the caption is hidden and the icon is all that is left. |
| Touch targets | — | all seven controls at 44×44 under `any-pointer: coarse` | same as benchmark |

## Reversion-to-failure table (AGENT.md, "Mutation-test every new gate")

16 mutants, 16 killed. Headless rows run `node tests/rich-bubble-toolbar.test.mjs`;
browser rows run `npm run visual -- --only mme-0089`. The package was rebuilt
between every round.

| # | Reversion | Killed by (verbatim) |
| --- | --- | --- |
| M1 | `toolbar.mode` default back to `"sticky"` | `Contract 4: a consumer that configures nothing must get no persistent formatting toolbar / expected: "hidden" / actual: "sticky"` |
| M2 | `align: "center"` falls through to `start` | `a 300px overlay centered on a 100px anchor at x=400 starts at x=300 / expected: 300 / actual: 400` |
| M3 | the code/opaque guard never matches | `a selection inside a fenced code block must not raise the formatting bubble / expected: false / actual: true` |
| M4 | `strikethrough` returns false | `strikethrough bytes, with neighbours untouched / expected "…alpha ~~bravo~~ charlie…" / actual "…alpha bravo charlie…"` |
| M5 | bubble `mousedown` no longer cancels the default | `@1280: removing the link did not return the document to its original bytes.` |
| M6 | turn-into entries never report unavailability | `@1280: converting a paragraph to a paragraph is a no-op and must be offered as unavailable, not as an inert control.` |
| M7 | bubble `max-width` back to the 320px cap | `@1280: 1 bubble control(s) are clipped out of the bubble or off the viewport (client 318 vs scroll 325): [{"testId":"selected-text-ai-bubble-action"}]` |
| M8 | focus not returned before the link input is removed | `@1280: Escape closed the whole bubble instead of just the link panel, discarding the selection. … "selectionRange":{"from":0,"to":0}` |
| M9 | `Cmd/Ctrl+K` always opens the palette | `@1280: Cmd/Ctrl+K over a selection must open link editing; it did not. … "paletteOpen":true` |
| M10 | the render does not restore focus | `@1280: the bubble must survive a scroll; before=true after=false` |
| M11 | constraint validation restored on the link field | `@1280: a relative Markdown destination was refused by the link field. / expected '- [Continue lists](./notes.md)' / actual '- Continue lists'` |
| M12 | the in-progress destination is discarded on re-render | `@1280: a re-render wiped the destination the writer was typing. / expected './notes.md' / actual ''` |
| M13 | `todo_item` is not recognised in the ancestry walk | `@1280: the turn-into control reported the wrong block type for "Continue todos". / expected 'Todo' / actual 'Bullet list'` |
| M14 | turn-into entries back to `role="menuitem"` | `aria-checked is not mapped on role=menuitem, so the current block type would be announced to nobody / expected "menuitemradio"` |
| M15 | accessible name drops the visible caption | `WCAG 2.5.3: the accessible name "Turn into" must contain the visible caption "Heading 2"` |
| M16 | a keyboard-run command leaves focus in the document | `@1280: the re-render destroyed the focused control instead of restoring focus to its replacement. active={"tag":"DIV","cls":"ProseMirror ProseMirror-focused"}` |

**One faulty mutant, recorded rather than counted.** The first M11 attempt inserted
`input.type = "url"` above the `const input` declaration; it failed to compile and
"killed" the gate on a TypeScript error, which proves nothing. Re-authored against
a single valid anchor and re-measured.

**One equivalent-mutant finding.** Flipping `input.type` alone survives, because
`form.noValidate` already disables constraint validation — the two are
belt-and-braces and neither is independently observable. M11 therefore reverts
both, which is the property the assertion is actually about.

## Notes

- The turn-into caption is hidden under coarse pointer: seven controls at the
  44px floor already fill a 390px viewport, and the control's icon carries the
  same information. The gate measures both the floor and the overflow.
- The bubble's `max-width` is the viewport, not a named menu width. The previous
  320px cap fitted four controls; with nine it clipped the AI entry out of the
  bubble's own box at every width.
