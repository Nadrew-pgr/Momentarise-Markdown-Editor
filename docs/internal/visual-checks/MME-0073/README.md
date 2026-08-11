# MME-0073 visual checks

Gate `mme-0073` — Rich Markdown table column operations baseline.

**What the gate proves.** Let framework consumers and users insert or delete columns in supported Rich Markdown tables through reusable package commands and reference command surfaces, while preserving Markdown as durable source, exact untouched bytes outside the owned table, deterministic serialization, semantic header/body cell types, nested footnote/list/task containers, history, selection, accessibility, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0073.mjs`](../../../../scripts/visual-check-mme0073.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0073
```

## Artifacts this gate writes

- `table-column-commands-unavailable.png`
- `table-column-final-protected.png`
- `table-column-commands-enabled.png`
- `table-column-inserted.png`
- `table-column-deleted.png`
- `table-column-saved-desktop.png`
- `table-column-unsupported-desktop.png`
- `table-column-constrained.png`
- `table-column-wide-constrained.png`
- `table-column-source-desktop.png`
