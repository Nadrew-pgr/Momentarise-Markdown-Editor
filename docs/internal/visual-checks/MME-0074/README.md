# MME-0074 visual checks

Gate `mme-0074` — Rich Markdown table row and column reorder baseline.

**What the gate proves.** Let framework consumers and users reorder body rows and columns in supported Rich Markdown tables through reusable package APIs and accessible adjacent-move commands, while preserving Markdown as durable source, the semantic header boundary, exact untouched bytes outside the owned table, deterministic serialization, nested footnote/list/task containers, history, selection, accessibility, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0074.mjs`](../../../../scripts/visual-check-mme0074.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0074
```

## Artifacts this gate writes

- `table-reorder-commands-unavailable.png`
- `table-reorder-boundaries.png`
- `table-reorder-commands-enabled.png`
- `table-row-moved.png`
- `table-column-moved.png`
- `table-reorder-saved-desktop.png`
- `table-reorder-unsupported-desktop.png`
- `table-reorder-constrained.png`
- `table-reorder-wide-constrained.png`
- `table-reorder-source-desktop.png`
