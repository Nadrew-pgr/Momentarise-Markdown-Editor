# MME-0104b — smart pairing and paste-URL-to-link, with a real keyboard

Gate: `npm run visual:mme-0104b` (registered in `scripts/visual-gates.mjs` as
`mme-0104b`, group `demo`). Dev server:
`npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`.
URL under test: `http://127.0.0.1:5174/`.

## Why this gate is the point of the issue

Pairing lives in `handleTextInput`, a view-level prop. A harness that drives
`tr.insertText` never reaches it — that is exactly how the previous attempt's
empty pairing implementation passed every assertion it had. Every row here is
typed with `page.keyboard.type`, and the paste rows dispatch a real
`ClipboardEvent` carrying a real `DataTransfer`, so a row can only pass if the
editor actually did the work.

## What the artifacts prove

| File | What it proves |
| --- | --- |
| `pairing-1280.png` | A document with a pasted link and every pair typed inline, dark scheme at 1280. The document is asserted, so the screenshot cannot claim more than was verified. |
| `pairing-390.png` | The same asserted document at 390 with touch emulation. |
| `pairing-1280-light.png` | The same asserted document in the light scheme. |
| `parity-checklist.json` | The behavioral parity checklist for contract 5's pairing and paste portions, generated from the table the browser asserts, plus the four paste decisions this issue was asked to settle. |
| `measurements.json` | Per-viewport evidence for every row, the Backspace collapse, all three paste cases, and the browser console error list. |

## Parity checklist — contract 5, pairing and paste portions

| Interaction | Typed | Result | Verdict |
| --- | --- | --- | --- |
| Pair `(` | `(` | `()`, caret between | same as benchmark |
| Pair `[` | `[` | `[]`, caret between | same as benchmark |
| Pair `{` | `{` | `{}`, caret between | same as benchmark |
| Pair `"` | `"` | `""`, caret between | same as benchmark |
| Pair `'` | `'` | `''`, caret between | same as benchmark |
| Pair `` ` `` | `` ` `` | ` `` `, caret between | same as benchmark |
| Step over the closer | `(x)` | `(x)`, not `(x))` | same as benchmark |
| Step over after edits | `(xyz)` | `(xyz)` | same as benchmark |
| Nested pairs | `([a])` | `([a])` | same as benchmark |
| Apostrophe inside a word | `don't` | `don't`, not `don''t` | same as benchmark |
| Backspace in an empty pair | `(` then Backspace | empty | same as benchmark |
| A code fence stays typeable | ` ```ts ` + code | a real fenced block | same as benchmark |
| Inline code still converts | `` `code` `` | `<code>` | same as benchmark |
| Paste a URL over a selection | paste over `docs` | `[docs](https://example.com)` | same as benchmark |
| Paste a non-URL | paste `manual` | replaces the selection | same as benchmark |
| Paste an unsafe scheme | paste `javascript:…` | never becomes a link | **better** — Notion has no equivalent guard |

Not covered here: block and inline input rules, which are `MME-0104a`.

`parity-checklist.json`'s `rows` holds the twelve typed rows. The Backspace
collapse and the three paste rows are asserted by the gate and recorded in
`measurements.json`; the paste decisions they encode are in `pasteDecisions`.

## The paste decisions this issue was asked to settle

- **URL definition:** a single whitespace-free token with an explicit scheme that
  passes `isSafeUrl` — the same `http`/`https`/`mailto` allowlist that already
  governs rendered and pasted hrefs. A permissive definition would turn
  `javascript:` payloads and bare words into links.
- **Selection already containing a link:** not wrapped. Nesting a link inside a
  link has no Markdown representation, and re-pointing the existing link would be
  an inference about intent, so the paste falls through to the default replace.
- **Selection spanning blocks:** not wrapped, for the same reason — a link cannot
  span two blocks. The paste falls through.
- **Anything that is not a URL:** falls through to today's replace behaviour.

## Rules that pairing had to be shaped around

Two interactions, both found by measuring rather than by review:

- **A symmetric delimiter never pairs after the same delimiter.** Without that,
  typing ``` opens a pair, steps over it, then opens another, so the user gets
  ```` and the code-fence input rule never matches.
- **Stepping over an auto-inserted closer re-triggers the input rules.** The
  step-over changes only the selection, and `appendTransaction` ignores
  transactions that do not change the document — so without an explicit trigger,
  pairing would silently break the shipped inline-code rule.
