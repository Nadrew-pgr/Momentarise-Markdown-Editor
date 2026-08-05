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
| One undo restores literal | `# `, `**bold**`, `[] ` | plain paragraph with the typed characters | same as benchmark — and since MME-0120 the literal survives a save too (`\#`, `\**bold**`) |

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

**The undo rows now round-trip.** One undo restores the literal characters on
screen, and since MME-0120 (commit `62480e8`) the serializer escapes them —
`\#`, `\**bold**` — so the literal survives a save and reopen. The undo rows
in `parity-checklist.json` quote the escaped serialization, asserted by this
gate. (This section previously recorded the pre-MME-0120 defect.)

## Known gaps recorded rather than hidden

- **An undo survives a save since MME-0120** (`62480e8`): the serializer
  escapes colliding literals, so `# ` reaches the file as `\#` and reopens as
  the same paragraph. This bullet previously recorded the defect.
- **Inline marks cannot be typed inside a table cell.** The context contract that
  stops `> ` destroying the table also blocks `**bold**` there. Recorded in
  `BACKLOG.md`.
- **Adjacent mark runs serialize one delimiter pair since MME-0121**
  (`6c108a1`): bolding across a code span writes ``**a `x` b**``. This bullet
  previously recorded the per-node `wrapMomentariseTextMarks` defect.
- **A trailing fenced code block keeps its final newline since MME-0120/0122**:
  the bisect run for MME-0122 showed MME-0120's escaping closed the typing
  path, and MME-0122 fixed the residual unclosed-fence-at-EOF loss and upgraded
  this gate's fence rows from prefix to equality. This bullet previously
  recorded the defect and the prefix workaround.
- **The 390 capture shows a todo layout defect**, not caused by this issue (no
  stylesheet is in its diff): the touch-sized toggle overlaps the start of its
  own label, and todo items are indented deeper than sibling bullets. Recorded in
  `BACKLOG.md`.

An earlier version of this file, of `BACKLOG.md` and of the build-log entry
claimed a gap that does not exist — "inline rules do not fire inside headings".
The UX reviewer disproved it against the built package: `requiresParagraph` is
set only on the block rules, so `# Title **bold**` produces a real `strong` mark
inside the `<h1>`. It is now an asserted parity row instead of a false gap.
