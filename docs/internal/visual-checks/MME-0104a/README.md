# MME-0104a — Markdown input rules, proven with a real keyboard

Gate: `npm run visual:mme-0104a` (registered in `scripts/visual-gates.mjs` as
`mme-0104a`, group `demo`). Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`.
URL under test: `http://127.0.0.1:5174/`.

## Why this gate exists separately from `tests/rich-input-rules.test.mjs`

Two failure modes the headless test cannot reach:

1. **The real input path.** The headless harness drives `tr.insertText`. A
   browser types through `beforeinput` → `handleTextInput` → ProseMirror's own
   insertion. The previous attempt at this issue was undone by exactly that gap.
2. **Vacuous byte assertions.** `# Title` and `**bold**` serialize identically
   whether or not the rule fired. Every row therefore asserts the **rendered
   element** (`requires`) as well as the Markdown, so matching bytes alone can
   never make a row pass.

## What the artifacts prove

| File | What it proves |
| --- | --- |
| `input-rules-1280.png` | H1, H2, bold/italic/inline code/strikethrough in one line, blockquote, thematic break, bullet, ordered list starting at 3, open and finished tasks, and a `ts` fenced block — dark scheme at 1280. The document itself is asserted, so the screenshot cannot show something other than what it claims. |
| `input-rules-390.png` | The same asserted document at 390 with touch emulation — the rules are not desktop-only. It also shows a pre-existing todo layout defect; see Known gaps. |
| `input-rules-1280-light.png` | The same asserted document in the light scheme. |
| `parity-checklist.json` | The behavioral parity checklist for benchmark contract 5 (block and inline portions), generated from the same table the browser asserts, so the checklist cannot drift from what was verified. |
| `measurements.json` | Per-viewport evidence: the serialized Markdown and the `requires`/`forbids` selector results for every row, plus the undo rows and the browser console error list. |

## Parity checklist — contract 5, block and inline portions

Each row was typed with a real keyboard in the demo, at all three viewports.

| Interaction | Typed | Result | Verdict |
| --- | --- | --- | --- |
| Heading 1 | `# Heading one` | `<h1>` | same as benchmark |
| Heading 2 | `## Heading two` | `<h2>` | same as benchmark |
| Heading 3 | `### Heading three` | `<h3>` | same as benchmark |
| Heading 6 | `###### Heading six` | `<h6>` | same as benchmark |
| Bullet list | `- Bullet` | `- Bullet` as `<ul><li>` | same as benchmark |
| Bullet list, `*` | `* Star` | `<ul><li>`, serialized `- Star` | intentionally different — canonical marker, see below |
| Bullet list, `+` | `+ Plus` | `<ul><li>`, serialized `- Plus` | intentionally different — canonical marker, see below |
| Ordered list | `1. First` | `1. First` as `<ol><li>` | same as benchmark |
| Ordered list, typed start | `3. Third` | `3. Third` as `<ol start="3">` | same as benchmark |
| Todo, unchecked | `[] Task` | `- [ ] Task` with a toggle | same as benchmark |
| Todo, checked | `[x] Done` | `- [x] Done`, toggle pressed | same as benchmark |
| Blockquote | `> Quote` | `> Quote` as `<blockquote>` | same as benchmark |
| Thematic break | `---` | `---` as `<hr>` | same as benchmark |
| Thematic break, `***` | `***` | `<hr>`, serialized `---` | intentionally different — canonical marker |
| Fenced code with language | ` ```ts ` + code | ` ```ts ` block as `<pre>` | same as benchmark |
| Bold | `**bold**` | `<strong>` | same as benchmark |
| Italic | `*italic*` | `<em>` | same as benchmark |
| Italic, underscore | `_soft_` | `<em>`, serialized `*soft*` | intentionally different — canonical marker, see below |
| Inline code | `` `code` `` | `<code>` | same as benchmark |
| Strikethrough | `~~gone~~` | `<s>` | **intentionally different** — contract 5 lists Notion's single `~strike~`; MME requires the CommonMark-GFM double |
| Strikethrough, single `~` | `~gone~` | literal, no `<s>` | intentionally different — the other half of the row above |
| Link | `see [MME](https://example.com)` | `<a href>` | **better** — no Notion equivalent; the destination passes the URL-safety allowlist first |
| Emphasis never swallows strong | `**bold** and *soft*` | `<strong>` + `<em>` | same as benchmark |
| …and the reverse ordering | `*soft* and **bold**` | `<em>` + `<strong>` | same as benchmark |
| Inline rule inside a heading | `# Title **bold**` | `<h1><strong>` | same as benchmark |
| No firing mid-word | `a**bold**` | literal, no `<strong>` | same as benchmark |
| No firing next to punctuation | `(**bold**)` | literal, no `<strong>` | **intentionally different** — Notion converts this; see below |
| No firing inside code | ` ```js ` + `**bold**` | literal inside `<pre>` | same as benchmark |
| One undo restores literal | `# `, `**bold**`, `[] ` | plain paragraph with the typed characters | same as benchmark **on screen only** — see below |

Not covered here, deliberately: `>` **toggle** (contract 5 says "quote/toggle";
toggle blocks are contract 6's separate issue), and pairing plus
paste-URL-to-link, which are `MME-0104b`.

**Canonical markers are a preservation property, not a conversion.** `_soft_`
→ `*soft*`, `* Star` → `- Star`, `+ Plus` → `- Plus`, `***` → `---`: the rule
creates a node, and a newly created node is written in canonical form. The
preservation guarantee is narrower than "your underscores are safe" — an
untouched `_emphasis_` is preserved byte-for-byte only while **its whole
top-level block** stays untouched. Editing anything else in the same paragraph
rewrites it. Measured:

```
"Alpha with _emphasis_ here.\n\nBravo\n"  + edit in Bravo  -> "_emphasis_" preserved
"Alpha with _emphasis_ here.\n"           + edit in "here" -> "*emphasis*" rewritten
```

**Punctuation-adjacent delimiters do not convert, on purpose.** MME-0104a's
criterion is "block start or whitespace", so `(**bold**)` stays literal where
Notion converts. Widening it needs CommonMark's flanking delimiter-run rule, not
a looser character class: allowing punctuation reintroduces `*italic*` swallowing
`**bold**`, because mid-typing `**bold*` has `*` before the match. Recorded in
`BACKLOG.md`.

**The undo row is honest only about the screen.** One undo restores the literal
characters in the editor, and that is asserted. It does **not** survive a save:
`# ` serializes to `#` and re-parses as an empty heading, `3. ` to `3.` and an
empty ordered list, `**bold**` back to bold. The undo rows in
`parity-checklist.json` quote the measured serialization for exactly this reason,
and the defect is recorded in `BACKLOG.md`.

## Known gaps recorded rather than hidden

- **An undo does not survive a save.** The literal characters are restored on
  screen but the paragraph serializer does not escape them, so `# ` re-parses as
  an empty heading. This is the widest gap and it partially undercuts this
  issue's own undo criterion. Recorded in `BACKLOG.md`.
- **Inline marks cannot be typed inside a table cell.** The context contract that
  stops `> ` destroying the table also blocks `**bold**` there. Recorded in
  `BACKLOG.md`.
- **Adjacent runs sharing an outer mark serialize one delimiter pair each**, so
  bolding across an existing code span produces ``**a ****`x`**** b**``. This is
  a pre-existing `wrapMomentariseTextMarks` defect, reachable today with no input
  rule at all via the `bold` command, and is recorded in `BACKLOG.md`.
- **A trailing fenced code block loses the document's final newline** in
  `session.getContent()`. Measured identical at `HEAD` before this issue, so the
  fence rows assert a prefix rather than pinning the defect into this gate.
  Recorded in `BACKLOG.md`.
- **The 390 capture shows a todo layout defect**, not caused by this issue (no
  stylesheet is in its diff): the touch-sized toggle overlaps the start of its
  own label, and todo items are indented deeper than sibling bullets. Recorded in
  `BACKLOG.md`.

An earlier version of this file, of `BACKLOG.md` and of the build-log entry
claimed a gap that does not exist — "inline rules do not fire inside headings".
The UX reviewer disproved it against the built package: `requiresParagraph` is
set only on the block rules, so `# Title **bold**` produces a real `strong` mark
inside the `<h1>`. It is now an asserted parity row instead of a false gap.
