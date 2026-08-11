# MME-0080 visual checks

Gate `mme-0080` — Rich table quoted-CSV clipboard paste baseline.

**What the gate proves.** Extend the preservation-first Rich table matrix-paste contract so a framework consumer or native editor paste can safely import quoted comma-separated clipboard data into an existing supported Markdown table without misclassifying ordinary prose, hand-rolling CSV grammar, weakening literal-cell safety, or rewriting bytes outside the owned table.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0080.mjs`](../../../../scripts/visual-check-mme0080.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0080
```

## Artifacts this gate writes

- `csv-paste-before.png`
- `csv-paste-quoted-literal.png`
- `csv-paste-undone.png`
- `csv-paste-source-saved.png`
- `csv-paste-wide-constrained-left.png`
- `csv-paste-wide-constrained-right.png`
