# MME-0070 visual checks

Gate `mme-0070` — Rich inert raw-HTML footnote block editing baseline.

**What the gate proves.** Let users edit parser-recognized block HTML as inert source text inside unique top-level footnote definitions, including one raw-HTML child inside a safe standard or task list item, while preserving Markdown durability, exact untouched bytes, container hierarchy, security boundaries, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0070.mjs`](../../../../scripts/visual-check-mme0070.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0070
```

## Artifacts this gate writes

- `footnote-raw-html-rich-desktop.png`
- `footnote-raw-html-edited-desktop.png`
- `footnote-raw-html-saved-desktop.png`
- `footnote-raw-html-unsupported-desktop.png`
- `footnote-raw-html-constrained.png`
- `footnote-raw-html-source-desktop.png`
