# MME-0069 visual checks

Gate `mme-0069` — Rich Obsidian callout footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable paragraph-only Obsidian callout bodies inside unique top-level footnote definitions, including one callout child inside a safe standard or task list item, while keeping callout type/title/fold semantics, Markdown source, hierarchy, unsupported fallbacks, history, and save truth intact.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0069.mjs`](../../../../scripts/visual-check-mme0069.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0069
```

## Artifacts this gate writes

- `footnote-callouts-rich-desktop.png`
- `footnote-callouts-edited-desktop.png`
- `footnote-callouts-saved-desktop.png`
- `footnote-callouts-unsupported-desktop.png`
- `footnote-callouts-constrained.png`
- `footnote-callouts-source-desktop.png`
