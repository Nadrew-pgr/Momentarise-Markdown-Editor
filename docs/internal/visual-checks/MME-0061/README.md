# MME-0061 visual checks

Gate `mme-0061` — Rich list-block GFM footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable standard list blocks inside unique top-level GFM footnote definitions while preserving Markdown container indentation, unrelated definition blocks, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0061.mjs`](../../../../scripts/visual-check-mme0061.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0061
```

## Artifacts this gate writes

- `footnote-list-rich-desktop.png`
- `footnote-list-edited-desktop.png`
- `footnote-list-unsupported-desktop.png`
- `footnote-list-constrained.png`
- `footnote-list-source-desktop.png`
