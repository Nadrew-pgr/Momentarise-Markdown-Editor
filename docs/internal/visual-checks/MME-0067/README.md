# MME-0067 visual checks

Gate `mme-0067` — Rich indented-code GFM footnote definition editing baseline.

**What the gate proves.** Let users edit safely representable indented code blocks inside unique top-level GFM footnote definitions, including one indented-code child inside a safe standard or task list item, while preserving code text, hierarchy, unrelated Markdown, source-only fallbacks, history, and save truth.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0067.mjs`](../../../../scripts/visual-check-mme0067.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0067
```

## Artifacts this gate writes

- `footnote-indented-code-rich-desktop.png`
- `footnote-indented-code-edited-desktop.png`
- `footnote-indented-code-saved-desktop.png`
- `footnote-indented-code-unsupported-desktop.png`
- `footnote-indented-code-constrained.png`
- `footnote-indented-code-source-desktop.png`
