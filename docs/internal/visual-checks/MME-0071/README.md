# MME-0071 visual checks

Gate `mme-0071` — Rich inert inline-HTML footnote paragraph editing baseline.

**What the gate proves.** Let users edit parser-recognized inline HTML tags and comments as inert literal source inside otherwise safe footnote paragraphs, including safe standard/task-list, blockquote, and callout paragraph contexts, while preserving Markdown durability, exact untouched bytes, bounded reconstruction, security boundaries, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0071.mjs`](../../../../scripts/visual-check-mme0071.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0071
```

## Artifacts this gate writes

- `footnote-inline-html-rich-desktop.png`
- `footnote-inline-html-edited-desktop.png`
- `footnote-inline-html-saved-desktop.png`
- `footnote-inline-html-unsupported-desktop.png`
- `footnote-inline-html-constrained.png`
- `footnote-inline-html-source-desktop.png`
