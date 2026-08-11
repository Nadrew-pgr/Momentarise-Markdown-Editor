# MME-0058 visual checks

Gate `mme-0058` — Rich GFM footnote identifier rename baseline.

**What the gate proves.** Let hosts rename one safely representable GFM footnote identifier and every matching semantic reference from Rich mode without collisions, partial repair, hidden state, or unrelated Markdown rewrites.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0058.mjs`](../../../../scripts/visual-check-mme0058.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0058
```

## Artifacts this gate writes

- `footnote-renamed-rich-desktop.png`
- `footnote-renamed-source-desktop.png`
- `footnote-renamed-rich-constrained.png`
