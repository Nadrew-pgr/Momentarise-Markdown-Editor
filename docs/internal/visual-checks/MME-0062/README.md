# MME-0062 visual checks

Gate `mme-0062` — Rich nested-list GFM footnote definition editing baseline.

**What the gate proves.** Let users edit text inside safely representable nested bullet and ordered lists within unique top-level GFM footnote definitions while preserving Markdown hierarchy, container indentation, unrelated definition blocks, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0062.mjs`](../../../../scripts/visual-check-mme0062.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0062
```

## Artifacts this gate writes

- `footnote-nested-list-rich-desktop.png`
- `footnote-nested-list-edited-desktop.png`
- `footnote-nested-list-unsupported-desktop.png`
- `footnote-nested-list-constrained.png`
- `footnote-nested-list-source-desktop.png`
