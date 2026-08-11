# MME-0064 visual checks

Gate `mme-0064` — Rich loose-list-item GFM footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable loose/list-spread and multi-paragraph standard or task list items inside unique top-level GFM footnote definitions while preserving blank-line semantics, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0064.mjs`](../../../../scripts/visual-check-mme0064.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0064
```

## Artifacts this gate writes

- `footnote-loose-list-rich-desktop.png`
- `footnote-loose-list-edited-desktop.png`
- `footnote-loose-list-toggled-desktop.png`
- `footnote-loose-list-saved-desktop.png`
- `footnote-loose-list-unsupported-desktop.png`
- `footnote-loose-list-constrained.png`
- `footnote-loose-list-source-desktop.png`
