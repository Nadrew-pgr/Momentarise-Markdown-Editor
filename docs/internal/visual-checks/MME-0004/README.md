# MME-0004 Visual Checks

## Manual UI scenario

1. Start the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1`.
2. Open `http://127.0.0.1:5173/`.
3. Verify the inspector shows the current fixture, round-trip mode, parser status, serializer status, and diagnostics.
4. Capture `roundtrip-status-loaded.png`.
5. Type Markdown in the source editor.
6. Verify round-trip status remains visible after edit and capture `roundtrip-status-after-edit.png`.

## Expected artifacts

- `roundtrip-status-loaded.png`
- `roundtrip-status-after-edit.png`

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1`
- Local URL: `http://127.0.0.1:5173/`
- Visual scenario: `npm run visual:mme-0004`

## Human review status

Human review is not required for MME-0004 if screenshots and reviewer checks verify the status panel.
