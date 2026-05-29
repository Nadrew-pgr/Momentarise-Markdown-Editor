# MME-0007 Visual Checks

## Manual UI scenario

1. Start or keep running the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1`.
2. Open `http://127.0.0.1:5173/`.
3. Verify CodeMirror source editing supports undo, redo, list continuation, checkbox continuation, empty list exit, checkbox exit into normal paragraph text, indentation, pairing, and code fence editing.
4. Verify selection remains stable when the inspector status refreshes without recreating the editor.
5. Verify source-only syntax still reports `opaque_preserved`.
6. Capture the required screenshots.

## Expected artifacts

- `source-editing-baseline-loaded.png`
- `source-editing-list-checkbox-exit.png` — proves list and checkbox continuation plus exit into normal paragraph text without stale markers.
- `source-editing-code-fence-keyboard.png`
- `source-editing-selection-preserved.png`

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1`
- Local URL: `http://127.0.0.1:5173/`
- Visual scenario: `npm run visual:mme-0007`

## Human review status

Human review is required because MME-0007 is the source editing baseline gate.
