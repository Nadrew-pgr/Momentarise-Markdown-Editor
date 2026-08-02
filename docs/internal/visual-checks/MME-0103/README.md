# MME-0103 — block selection model, browser evidence

Produced by `npm run visual:mme-0103` against the demo dev server.

- Command: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
  (the `md-demo` entry in `.claude/launch.json`).
- URL: `http://127.0.0.1:5174/` — the same URL a human reviewer opens.
- Viewports: 1280x900 desktop dark, 390x844 touch dark, and 1280x900 desktop
  light. The light scheme mixes the selection token at less than half the dark
  alpha, so it is the weaker case for "visually distinct" and is verified rather
  than assumed.

`measurements.json` holds the machine-readable evidence behind each assertion:
the painted selection, the computed `::selection` colour, the clipboard payload,
and the Markdown after every operation.

## What each screenshot proves

| File | What it proves |
| --- | --- |
| `block-selected-*.png` | `Esc` from a caret selects that block as an object. The block carries a token-driven ring plus tint; nothing else is marked; the state is announced with the block's identity — "Paragraph, block 3 of 6: A paragraph the block layer removes." — in the plugin's own live region. The run measures the ring against the page and requires >= 3:1 (WCAG 1.4.11): `rgb(138,180,255)` on `rgb(10,10,10)` in dark, `rgb(0,87,194)` on `rgb(251,252,255)` in light. |
| `multi-block-selected-*.png` | `Shift+ArrowDown` extends the selection across a framed table and a code fence. All three blocks are painted as objects, and the run asserts the table carries the same ring a paragraph does — before the ring it showed no fill at all, because a table paints its own cell backgrounds over any tint. The computed `::selection` colour on both the editor and the selected block is `rgba(0, 0, 0, 0)`, so no per-character text highlight is drawn — an acceptance criterion only a browser can settle. |
| `after-delete-*.png` | `Backspace` on that three-block selection removes exactly those blocks. The run asserts the resulting Markdown against a full expected string, including the four-newline gap the author wrote after the surviving paragraph. |
| `after-duplicate-*.png` | `Cmd/Ctrl+D` inserts the copy immediately after the original and joins it with the document's authored separator rather than an invented one. |
| `slash-menu-open-*.png` | Setup for the collision case: `/head` typed at the end of a paragraph, slash menu open. |
| `escape-dismisses-only-the-menu-*.png` | One `Esc`, one meaning. The menu is dismissed, the typed `/head` survives byte-for-byte, and **no** block is selected. This was a regression in attempt 1: the overlay dismiss controller binds Escape with `capture: true`, so a single press did both. The very next `Esc` does enter block selection, which the run asserts immediately after this shot. |

## Two things this run cannot prove, and where they are proven instead

- **Line endings.** The demo deliberately normalises line endings inside the
  editor and restores the file's own ending at the save target, so the browser
  never sees CRLF bytes. CRLF preservation is asserted headlessly in
  `tests/rich-block-selection.test.mjs` against
  `fixtures/040-block-selection/input-crlf.md`, with `assert.equal` on full
  output.
- **Byte-exact undo.** The demo re-parses after every rich edit
  (`syncRichMarkdownToSource`), which makes the post-delete text the preservation
  baseline; the blocks an undo brings back are therefore new to the serializer
  and take the document's own gap. The browser run asserts that one press
  restores every block with its content intact; byte-exact undo is asserted at
  package level, where the baseline is the original source — which is what a host
  that keeps its baseline (`@momentarise/md-react`) does.

## Observed, not owned by this issue

At 390px several blocks show their `+` / `⠿` affordances at once in a
pointer-less screenshot. That is MME-0087 territory (hover scoping on a touch
viewport), unchanged by this slice, and is recorded here rather than fixed.
