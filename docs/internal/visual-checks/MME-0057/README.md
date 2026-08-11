# MME-0057 visual checks

Gate `mme-0057` — Rich GFM footnote insertion baseline.

**What the gate proves.** Let users insert a new Markdown-native footnote reference and matching simple definition from Rich mode without full-document serialization, identifier collisions, or hidden non-Markdown state.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0057.mjs`](../../../../scripts/visual-check-mme0057.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0057
```

## Artifacts this gate writes

- `footnote-command-desktop.png`
- `footnote-inserted-desktop.png`
- `footnote-source-desktop.png`
- `footnote-inserted-constrained.png`
