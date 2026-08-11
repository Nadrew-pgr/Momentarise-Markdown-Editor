# MME-0038 visual checks

Gate `mme-0038` — Public docs site and AX docs surface.

**What the gate proves.** Ship the public docs site as a read-only MME showcase with first-class Agentic Experience: the site renders the `docs/public/` Markdown through MME itself and exposes agent-friendly actions on every page.

**Screenshots are not committed.** They are regenerated on every run and uploaded by CI
(`visual-gate-screenshots`); see the artifact policy in
[`docs/internal/visual-checks/README.md`](../README.md). The assertions in
[`scripts/visual-check-mme0038.mjs`](../../../../scripts/visual-check-mme0038.mjs) are the proof; the images are how a human confirms it.

## Regenerate

```bash
npm run visual -- --only mme-0038
```

## Artifacts this gate writes

- `site-landing.png`
- `site-footer.png`
- `docs-dark.png`
- `docs-home.png`
- `docs-home-demo.png`
- `docs-footer.png`
- `docs-page-actions.png`
- `docs-package-md-cli.png`
- `docs-agentic-experience.png`
- `docs-package-code-dark.png`
- `docs-mobile-package.png`
- `docs-mobile.png`
