# MME-0072 visual checks

Gate `mme-0072` — Rich Markdown table row operations baseline.

**What the gate proves.** Let framework consumers and users insert or delete body rows in supported Rich Markdown tables through reusable package commands and reference command surfaces, while preserving Markdown as durable source, exact untouched bytes outside the owned table, deterministic serialization, nested footnote/list/task containers, history, selection, accessibility, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0072.mjs`](../../../../scripts/visual-check-mme0072.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0072
```

## Artifacts this gate writes

- `table-row-commands-unavailable.png`
- `table-row-commands-enabled.png`
- `table-row-inserted.png`
- `table-row-deleted.png`
- `table-row-saved-desktop.png`
- `table-row-unsupported-desktop.png`
- `table-row-constrained.png`
- `table-row-wide-constrained.png`
- `table-row-source-desktop.png`
