# MME-0059 visual checks

Gate `mme-0059` — Rich multiline GFM footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable top-level multiline GFM footnote definitions from Rich mode while preserving Markdown structure, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0059.mjs`](../../../../scripts/visual-check-mme0059.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0059
```

## Artifacts this gate writes

- `footnote-multiline-rich-desktop.png`
- `footnote-multiline-edited-desktop.png`
- `footnote-multiline-constrained.png`
- `footnote-multiline-source-desktop.png`
