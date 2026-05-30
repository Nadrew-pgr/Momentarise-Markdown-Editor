# MME-0012 Visual Checks

## Manual UI scenario

1. Start or keep running the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174 --strictPort`.
2. Open `http://127.0.0.1:5174/`.
3. Load a Markdown document with a heading, paragraph, code fence, and real unsupported extension syntax.
4. Switch from Source to Rich.
5. Edit a heading and paragraph in Rich mode.
6. Use Enter to create a new paragraph.
7. Verify undo/redo works.
8. Edit code fence content in Rich mode.
9. Verify imported-copy documents show `Download` as the primary action, not `Save`.
10. Switch back to Source and verify Markdown contains the rich edits and still preserves unsupported syntax exactly once.

## Expected artifacts

- `rich-mode-loaded.png` — proves the ProseMirror rich view loads from Markdown.
- `rich-heading-paragraph-edited.png` — proves heading/paragraph edits and Enter-created text are visible in rich mode.
- `rich-code-fence-edited.png` — proves code fence content is editable in rich mode.
- `source-after-rich-roundtrip.png` — proves switching back to source serializes rich edits to Markdown and keeps unsupported extension syntax without duplication.

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174 --strictPort`
- Local URL: `http://127.0.0.1:5174/`
- Visual scenario: `MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0012`

## Human review status

MME-0012 status is `code-complete/pending human review` until the first rich-mode slice is accepted by a human.
