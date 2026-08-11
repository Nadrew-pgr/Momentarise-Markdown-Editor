# MME-0068 visual checks

Gate `mme-0068` — Rich table GFM footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable GFM pipe tables inside unique top-level footnote definitions, including one table child inside a safe standard or task list item, while preserving table semantics, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0068.mjs`](../../../../scripts/visual-check-mme0068.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0068
```

## Artifacts this gate writes

- `footnote-tables-rich-desktop.png`
- `footnote-tables-edited-desktop.png`
- `footnote-tables-saved-desktop.png`
- `footnote-tables-unsupported-desktop.png`
- `footnote-tables-constrained.png`
- `footnote-tables-wide-constrained.png`
- `footnote-tables-source-desktop.png`
