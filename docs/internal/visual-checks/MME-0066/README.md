# MME-0066 visual checks

Gate `mme-0066` — Rich fenced-code GFM footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable fenced code blocks inside unique top-level GFM footnote definitions, including one fenced-code child inside a safe standard or task list item, while preserving code text, language/meta, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0066.mjs`](../../../../scripts/visual-check-mme0066.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0066
```

## Artifacts this gate writes

- `footnote-fenced-code-rich-desktop.png`
- `footnote-fenced-code-edited-desktop.png`
- `footnote-fenced-code-saved-desktop.png`
- `footnote-fenced-code-unsupported-desktop.png`
- `footnote-fenced-code-constrained.png`
- `footnote-fenced-code-source-desktop.png`
