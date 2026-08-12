# MME-0080 visual checks

Gate `mme-0080` — Rich table quoted-CSV clipboard paste baseline.

**What the gate proves.** Extend the preservation-first Rich table matrix-paste contract so a framework consumer or native editor paste can safely import quoted comma-separated clipboard data into an existing supported Markdown table without misclassifying ordinary prose, hand-rolling CSV grammar, weakening literal-cell safety, or rewriting bytes outside the owned table.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0080.mjs`](../../../../scripts/visual-check-mme0080.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0080
```

## This gate had never passed until 2026-08-12

MME-0080 was accepted in 2026-06 on a gate that has never been green, and the closeout
did not re-run the browser script. MME-0114 found it; MME-0116 repaired it.

**What was wrong.** The gate scrolled `table.parentElement` — `.ProseMirror`, which is
`overflow-x: visible` and therefore not a scroll container at all. Nothing the gate did
could move it, so its `waitForFunction(scrollLeft > 0)` could only ever time out. Its
`tableScrollable` precondition was `scrollWidth > clientWidth` on that same non-scrolling
element. The committed evidence at the time was five screenshots and no `result.json`.

**What is true now**, measured by the repaired gate at 390px against
`.rich-editor-host`, the element that actually carries `overflow-x: auto`
(`result.json`, `containment`):

| | start | end |
| --- | --- | --- |
| `scrollLeft` | 400 | 463 |
| `scrollWidth` | 853 | 853 |
| `clientWidth` | 390 | 390 |
| `scrollerOverflow` | `auto` | `auto` |

463 is the true maximum (853 − 390), and the gate now asserts the movement rather than a
bare `> 0`, which was already satisfied at capture-start. The page itself never overflows
(`pageScrollWidth === pageClientWidth === 390`), which is the containment claim MME-0080
was accepted on — so **the feature's behaviour is confirmed, and only the gate was
vacuous**. The CSV paste feature itself was, and remains, covered by unit tests.

`result.json` is committed here as the durable record of that correction.

## Artifacts this gate writes

- `csv-paste-before.png`
- `csv-paste-quoted-literal.png`
- `csv-paste-undone.png`
- `csv-paste-source-saved.png`
- `csv-paste-wide-constrained-start.png` — renamed from `…-left.png` by MME-0116: it is
  taken where the paste leaves the host (scrollLeft 400), not at the left edge.
- `csv-paste-wide-constrained-right.png`
