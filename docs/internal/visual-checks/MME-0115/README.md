# MME-0115 — composition over a block selection

Run: `npm run visual -- --only mme-0115` (starts the demo dev server itself), or
`npm run visual:mme-0115` against an already-running demo.

Source document, identical in every row:

```markdown
Alpha block.

Bravo block.

Charlie block.

Delta block.
```

## Why this gate is the primary evidence

A composition cannot be faithfully simulated. The sequence that destroys the
selected blocks is Chromium's own DOM work between `compositionstart` and
`compositionend`, so any headless reproduction is a replay of transactions
someone *believed* the browser dispatches. This gate uses the real pipeline:
CDP `Input.imeSetComposition` starts and updates the composition,
`Input.insertText` commits it, and `imeSetComposition` with an empty string
cancels it — the same transitions macOS produces for `option+e` then `e`, or for
`option+e` then `Escape`.

`tests/rich-composition-baseline.test.mjs` is the headless companion: it makes
the class regressible inside `npm test`, and it states in its own header which
steps it replays rather than performs.

## What each row proves

| Row | Gesture | Claim |
| --- | --- | --- |
| `plain-keystroke-control` | one block selected, type `x` | the yardstick: what an ordinary keystroke does to the document, the bytes, and the live region |
| `cancel-single` | one block selected, dead key, cancel | the block comes back, stays selected, and the file on disk is byte-identical |
| `cancel-multi` | two blocks selected, dead key, cancel | the same for a multi-block selection — both blocks, not just the anchor |
| `commit-single` | one block selected, `é` committed | the selection is replaced by the composed character, neighbours byte-identical |
| `commit-multi` | two blocks selected, `é` committed | both blocks replaced by one paragraph, neighbours byte-identical |
| `cancel-ime-session` | full IME candidate session (`に` → `にほ` → `にほん`), cancel | a long composition with several updates restores exactly like a dead key |
| `commit-ime-session` | the same session committed as `日本` over two blocks | multi-update compositions replace the whole selection |
| `commit-tilde` | `ñ` committed over one block | a second dead key, because the acceptance criteria name three |
| `commit-then-undo` | commit over two blocks, then `Cmd/Ctrl+Z` | the commit is one undoable transaction — and the positive control proving the undo keystroke reaches the editor at all |
| `cancel-then-undo` | cancel, then `Cmd/Ctrl+Z` | undo steps past the whole non-event instead of replaying the composition's inverse steps onto the restored document (which produced a duplicated block) |

Every composition row asserts these independently, because each has been green
while another was wrong at some point in this issue's history:

1. **The defect was reproduced.** Mid-composition, the selected blocks must have
   been replaced by the composing text. Without this a cancel row's expectation
   — the original document — is also the document before anything composed, so a
   run where the IME never reached the editor would pass while proving nothing.
2. the blocks the editing surface shows afterwards, by text;
3. how many blocks are painted as selected (`data-mme-block-selected`);
4. the Markdown — both `getMarkdown()` and the bytes that reach the writable file
   handle through a real save;
5. what the live region says: nothing at all for a cancel, and for a commit the
   same thing the plain-keystroke control leaves it saying.

The painted selection count is also asserted **before** composing. An unfocused
editor turns the whole run into a test of a text selection, which would pass
while proving nothing about this issue; attempt 1 recorded that failure mode.

The row order matters in one place: the plain-keystroke control runs first,
because the commit rows compare their announcement against it.

## Artifacts

- `composition-cancel-<viewport>.png` — captured at the end of the `cancel-single`
  row, so it shows the restored document with its block selection still painted,
  at 1280 dark, 390 touch dark, and 1280 light.
  Screenshots are gate output and are not committed (MME-0116 artifact policy);
  CI uploads them.
- `measurements.json` — per viewport and row: the blocks and selection count
  while composing and afterwards, every live-region announcement recorded during
  the composition, the resulting Markdown, and the bytes on disk.
