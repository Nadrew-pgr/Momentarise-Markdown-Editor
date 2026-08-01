# MME-0088 — Slash trigger correctness

Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
URL verified: `http://127.0.0.1:5174/`
Capture: `npm run visual:mme-0088` → `scripts/visual-check-mme0088.mjs`
Widths: 1280 × 900 and 390 × 844 (`hasTouch`).

Everything is typed **through the real keyboard**, not through a test hook. The
reported defect is that typing `/` in a fenced code block both inserted the
character and opened the menu, and only real keystrokes exercise that path.

## What each screenshot proves

| File | Proves |
| --- | --- |
| `paragraph-triggers-1280.png`, `-390.png` | `/head` typed after a space in a paragraph opens the menu — the positive case, so the negatives below are not passing because the trigger is simply broken. |
| `code-block-no-trigger-1280.png`, `-390.png` | The same keystrokes inside a fenced code block leave the menu closed, while the characters land in the code (`const inCode /head = 1;`). |

## Context matrix asserted in the browser, at both widths

| Context | Menu opens |
| --- | --- |
| Paragraph, after a space | **yes** |
| Fenced code block | no |
| Inline code mark | no |
| Table cell | no |
| Mid-word (`case./head`) | no |
| Source (CodeMirror) surface | no |

The script fails unless it observes **one positive and at least five negatives** —
a matrix of all-negatives would otherwise pass while the feature was simply dead.

Byte-level evidence recorded in `measurements.json`:

- the fixture loads byte-identical before any typing;
- after dismissing with Escape the document reads
  `A paragraph for the positive case. /head` — the typed characters are preserved
  exactly, as the acceptance criteria require;
- after choosing a command, `/head` is gone from the document;
- in the code block the `/` is present in the code and the menu never opened.

## Package contract, not demo wiring

`richTextInputContext` and `matchRichSlashTrigger` are exported from
`@momentarise/md-rich-prosemirror`, so a consumer composing the editor gets the
same trigger rules. MME-0104's input rules need exactly the same "is this a safe
context" judgement, which is why it is one shared answer rather than two regexes.

Preservation is the reason the unsafe list looks the way it does: code, inline
code, raw HTML and opaque blocks carry bytes the user means to keep, so a typed
character there must stay literal rather than becoming an editor gesture.

## Also asserted (all added after the reviewer pass)

- **Escape sticks.** The menu is re-derived from the document on every
  transaction, so without a memory of the dismissal it reopened on the next
  keystroke — Escape only closed it for one frame, and the first version of this
  gate observed exactly that frame.
- **Deleting the `/` closes it**, and the line returns byte-exact.
- **Arrowing past either end dismisses** rather than wrapping. Wrapping meant the
  menu could never be escaped with the arrow keys at all.
- **A real outside click dismisses it** (a synthetic `MouseEvent` does not — the
  shared MME-0086 controller listens for `pointerdown` on capture).
- **The inline-code case is typed with a leading space**, so the mid-word rule
  cannot be what closes the menu; the inline-code guard has to do the work.

## Gates proven to fail before they were trusted

| Reverted fix | Gate that caught it |
| --- | --- |
| Drop the context guard from `matchRichSlashTrigger` | unit: `typing "/" in a fenced code block must not open the slash menu`; browser: `@1280: "/" inside a fenced code block must NOT open the menu` |
| Drop the mid-word guard | `` `/` immediately after a word character must not open the menu `` |
| Drop the Escape suppression | `typing after Escape must not reopen the menu the user just dismissed` |
| Restore wrapping arrow navigation | `ArrowUp at the first item must dismiss the menu, not wrap to the last` |

## Behavioral parity checklist — contract 6 (slash trigger half)

| Interaction | Benchmark | MME after MME-0088 | Verdict |
| --- | --- | --- | --- |
| `/` at the start of an empty block | Notion opens the menu | Opens | same as benchmark |
| `/` after a space | Notion opens the menu | Opens | same as benchmark |
| `/` mid-word (`and/or`) | BlockNote/tiptap require whitespace or start-of-block | Does not open | same as benchmark (BlockNote). Notion itself opens on any `/`; the stricter rule is deliberate, and is what broke the five sibling gates repaired below |
| `/` in a code block | Notion has no code-block slash menu | Does not open; the character is typed normally | same as benchmark |
| `/` in inline code | Not a command context | Does not open | same as benchmark |
| `/` in a table cell | BlockNote allows it in empty cells | Never opens in a table cell | intentionally different — the AC explicitly allows either; one behaviour picked and tested |
| Dismissing the menu | Typed text stays | Typed text stays, byte for byte | same as benchmark |
| Choosing a command | The `/query` is consumed | Consumed | same as benchmark |
| Source surface | No slash menu | Never opens | same as benchmark |
| Frontmatter | Not a command context | Structurally impossible: frontmatter is held as `frontmatterSource` and never enters the rich document, so no caret can be placed in it | same as benchmark |

## Corrections made after the reviewer pass

- **The mid-word rule broke five other issues' shipped gates.** `npm test` did not
  catch it because `visual:*` scripts are not part of `npm test`. Repaired:
  MME-0013 (two cases), MME-0027, MME-0028, MME-0028.5 — all typed `/x` directly
  after a word character. One of them, MME-0013's "unsupported slash command in
  code block", asserted that typing `/bold` inside a fenced code block **opened**
  the menu — it asserted the exact defect this issue removes, and is now inverted.
- **Two pre-existing failures found while sweeping, neither caused by this issue**
  and neither fixed here: MME-0013's "slash keyboard navigation" step (verified
  by stashing this issue's changes — it fails identically on the previous commit)
  and MME-0027's "host parameterized AI prompt" step, which is in the AI command
  palette path and never touches the slash trigger.
- **`/` in body-text HTML is not protected.** The `raw_html_source` mark is only
  applied inside footnote content, so `/` typed after a space inside an inline
  HTML tag in ordinary text does open the menu. Low impact — the character is
  inserted either way and dismissal preserves bytes — but the "raw HTML is
  protected" claim holds for footnote content only.
- **Callout bodies are unreachable rather than allowed.** A callout parses to a
  single opaque atom today, so there is no body to type in. Notion allows `/`
  there; MME-0105 owns callout editing and inherits this.
- **The mid-word rule is stricter than Notion's**, which opens on any `/`. It
  matches BlockNote/tiptap's `allowedPrefixes: [' ']`. That is the deliberate
  choice, and it is why the five gates above needed repair.
