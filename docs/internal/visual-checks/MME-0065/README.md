# MME-0065 visual checks

Gate `mme-0065` — Rich blockquote GFM footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable paragraph-only blockquotes inside unique top-level GFM footnote definitions, including one quote child inside a safe standard or task list item, while preserving quote/blank-line semantics, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0065.mjs`](../../../../scripts/visual-check-mme0065.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0065
```

## Artifacts this gate writes

- `footnote-blockquote-rich-desktop.png`
- `footnote-blockquote-edited-desktop.png`
- `footnote-blockquote-saved-desktop.png`
- `footnote-blockquote-unsupported-desktop.png`
- `footnote-blockquote-constrained.png`
- `footnote-blockquote-source-desktop.png`
