# MME-0011.5 Visual Checks

## Manual UI scenario

1. Start or keep running the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174 --strictPort`.
2. Open `http://127.0.0.1:5174/`.
3. Load the frontmatter visual fixture as an imported copy.
4. Verify the round-trip source label says `Imported copy`, not `Fixture`.
5. Verify a long frontmatter list shows an overflow note.
6. Trigger the unsupported local-file state and verify the UI says unsupported.

## Expected artifacts

- `properties-visible-frontmatter.png` — proves imported-copy labeling and the frontmatter overflow note.
- `unsupported-local-file-state.png` — proves unsupported local file access is represented as unsupported.

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174 --strictPort`
- Local URL: `http://127.0.0.1:5174/`
- Visual scenario: `MME_VISUAL_DIR=docs/internal/visual-checks/MME-0011.5 MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0011`

## Human review status

MME-0011.5 status is `code-complete/pending human review` until the alignment gate is accepted by a human.
