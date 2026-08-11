# MME-0063 visual checks

Gate `mme-0063` — Rich task-list GFM footnote definition editing baseline.

**What the gate proves.** Let users edit text and checked state inside safely representable flat or recursively nested GFM task lists within unique top-level footnote definitions while preserving Markdown hierarchy, unrelated source, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0063.mjs`](../../../../scripts/visual-check-mme0063.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0063
```

## Artifacts this gate writes

- `footnote-task-list-rich-desktop.png`
- `footnote-task-list-toggled-desktop.png`
- `footnote-task-list-saved-desktop.png`
- `footnote-task-list-unsupported-desktop.png`
- `footnote-task-list-constrained.png`
- `footnote-task-list-source-desktop.png`
