# MME-0060 visual checks

Gate `mme-0060` — Rich multi-paragraph GFM footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable top-level multi-paragraph GFM footnote definitions from Rich mode while preserving Markdown paragraph boundaries, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0060.mjs`](../../../../scripts/visual-check-mme0060.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0060
```

## Artifacts this gate writes

- `footnote-multiparagraph-rich-desktop.png`
- `footnote-multiparagraph-edited-desktop.png`
- `footnote-multiparagraph-constrained.png`
- `footnote-multiparagraph-source-desktop.png`
