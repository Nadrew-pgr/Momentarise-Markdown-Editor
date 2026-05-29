# MME-0008 Visual Checks

## Manual UI scenario

1. Start or keep running the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`.
2. Open `http://127.0.0.1:5174/`.
3. Verify the initial fixture says memory-only and not persisted.
4. Type Markdown and verify the document becomes dirty with Save Engine hashes visible.
5. Wait for autosave and verify the UI returns to clean memory-only saved state without saying plain `saved`.
6. Type another edit, use `Cmd/Ctrl+S`, and verify the Save Engine flushes through the keyboard shortcut.
7. Type a conflict candidate, simulate an external change, save, and verify the UI reports conflict without overwriting.
8. Capture the required screenshots.

## Expected artifacts

- `save-engine-initial.png` — proves the initial fixture is memory-only, clean, and not persisted to disk.
- `save-engine-dirty.png` — proves editing marks the Save Engine dirty.
- `save-engine-autosaved.png` — proves autosave returns to memory-only saved state with target context.
- `save-engine-shortcut-flush.png` — proves `Cmd/Ctrl+S` flushes through the Save Engine by showing the visible Last action row.
- `save-engine-conflict.png` — proves external modification simulation produces conflict, exposes the external hash, and visibly records blocked overwrite.

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
- Local URL: `http://127.0.0.1:5174/`
- Visual scenario: `MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0008`

## Human review status

Human review is required because MME-0008 changes user-critical save truthfulness.
