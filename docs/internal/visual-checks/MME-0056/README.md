# MME-0056 visual checks

Gate `mme-0056` — Rich GFM footnote definition editing baseline.

**What the gate proves.** Make safely representable existing GFM footnote definitions directly editable in Rich mode while preserving references, complex definitions, and unrelated Markdown exactly.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0056.mjs`](../../../../scripts/visual-check-mme0056.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0056
```

## Artifacts this gate writes

- `footnote-editable-desktop.png`
- `footnote-edited-desktop.png`
- `footnote-edited-constrained.png`
