# MME-0120 — visual verification

**Gate:** `npm run visual:mme-0120` (`scripts/visual-check-mme0120.mjs`).
**Dev server:** `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
(started from `.claude/launch.json`). **URL:** `http://127.0.0.1:5174/`.

## What this gate proves that the unit suite cannot

`tests/serializer-escaping.test.mjs` proves the serializer. It cannot prove the
sentence the issue is about, which spans four systems: a real keyboard produces
the conversion, a real `Mod+Z` undoes it, the Save Engine writes real bytes
through a writable file handle, and re-opening those bytes runs the parser
again. Each of the six rows does all four, then asserts the **rendered element**
of the re-opened document.

That last assertion is the one that matters. Asserting Markdown alone would not
catch the defect, because `#` and `\#` are both "the file contains a hash". The
defect's signature is that the bytes look plausible while the reopened document
is a different construct:

> type `# `, undo → screen shows `# ` → file held `#` → re-opened as `<h1>`,
> empty, the characters gone.

## Rows

| id | typed | on screen after undo | bytes on disk | re-opens as |
| --- | --- | --- | --- | --- |
| `heading-marker` | `# ` | `# ` | `\#` | paragraph `#` |
| `ordered-marker` | `3. ` | `3. ` | `3\.` | paragraph `3.` |
| `bullet-marker` | `- ` | `- ` | `\-` | paragraph `-` |
| `blockquote-marker` | `> ` | `> ` | `\>` | paragraph `>` |
| `bare-todo` | `[] ` | `[] ` | `[]` | paragraph `[]` |
| `strong-delimiters` | `**bold**` | `**bold**` | `\**bold**` | paragraph `**bold**` |

Plus a neighbour-preservation case: `Alpha` / `Bravo` / `Charlie`, edit only
`Bravo`, and both neighbours must stay byte-identical
(`Alpha\n\nBravo a\**bold**\n\nCharlie\n`), then re-open as three literal
paragraphs with no `strong` anywhere.

The trailing space of `# ` / `- ` / `> ` does not reach the file. Markdown
cannot carry a space at the end of a block; the serializer trims it, and the
parser would drop it anyway. The characters that carry meaning survive, which is
what "the characters are gone" was about.

## Screenshots

- `escaping-1280.png` — 1280×900, dark.
- `escaping-390.png` — 390×844, coarse pointer, dark.
- `escaping-1280-light.png` — 1280×900, light.

All three show the same asserted document: five escaped markers rendering as
literal paragraphs (`# not a heading`, `3. not a list`, `- not a bullet`,
`> not a quote`, `a**bold** stays literal`) above one paragraph where real bold
still renders. The document is asserted before the screenshot is taken — the
gate fails if a heading, list or blockquote element appears, and fails if no
`strong` element appears — so the screenshot cannot show something other than
what this file claims. The second half is the point: escaping is targeted, not
global.

## The gate was mutation-tested

This repository has shipped gates that reported green while checking nothing, so
the gate itself was broken deliberately:

| Reversion | Gate failure |
| --- | --- |
| serializer verification skipped (pre-fix behaviour) | `'#\n' !== '\\#\n'` — the disk-bytes assertion |
| same, with the disk assertion neutralised | `'h1' !== 'p'` — the re-opened document |

The second row is the important one: with the byte assertion silenced, the gate
still catches the file re-opening as a heading, which is the defect a writer
would actually experience.

## Human review

Not required by the issue. `measurements.json` carries every measured value,
including the bytes each row wrote to disk.
