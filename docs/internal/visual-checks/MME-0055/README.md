# MME-0055 visual checks

Gate `mme-0055` — Rich GFM table editing baseline.

**What the gate proves.** Make standard GFM pipe tables directly editable in Rich mode without weakening Markdown source preservation or pretending MME is a spreadsheet.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0055.mjs`](../../../../scripts/visual-check-mme0055.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0055
```

## Artifacts this gate writes

- `table-editable-desktop.png`
- `table-edited-desktop.png`
- `table-edited-constrained.png`
- `table-wide-constrained.png`
