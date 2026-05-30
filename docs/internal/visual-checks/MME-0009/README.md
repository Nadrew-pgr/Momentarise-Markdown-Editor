# MME-0009 Visual Checks

## Manual UI scenario

1. Start or keep running the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`.
2. Open `http://127.0.0.1:5174/`.
3. Verify the header exposes `Open .md`, `Import copy`, `Download`, and `Save`.
4. Open a local Markdown file in a browser with File System Access API support, edit it, use `Cmd/Ctrl+S`, and verify the original file changes on disk.
5. In unsupported/fallback mode, import a copy, edit it, save, and verify the UI says download/export is required instead of claiming the original file was overwritten.
6. Capture the required screenshots.

## Expected artifacts

- `local-file-controls-initial.png` — proves the visible UI exposes local open/import controls before a file is selected.
- `writable-crlf-opened-clean.png` — proves a CRLF writable document opens clean instead of becoming dirty from line-ending normalization.
- `writable-file-opened.png` — proves a writable Markdown document shows disk mode, original-file status, and the opened filename/path.
- `writable-file-saved-to-disk-target.png` — proves editing plus `Cmd/Ctrl+S` writes through a writable file target and returns to disk-saved state.
- `imported-copy-opened.png` — proves fallback import mode is labeled as an imported copy requiring download/export.
- `imported-copy-download-required.png` — proves fallback save is blocked honestly and does not claim to overwrite the original file.

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
- Local URL: `http://127.0.0.1:5174/`
- Visual scenario: `MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0009`

## Human review status

Human review accepted on 2026-05-30 for Google Chrome headed-browser behavior. The Codex in-app browser may still fail or report errors for native File System Access API persistence; that is treated as a host limitation, not as proof that the Chrome path is broken.

## QA status

Completed:

- Dev server command verified: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`.
- Local URL verified: `http://127.0.0.1:5174/`.
- Automated visual scenario completed with a writable file-handle test double so disk-write screenshots are repeatable.
- Fallback import/download-required scenario completed and captured.
- In-app browser check confirmed `Open .md`, `Import copy`, `Save`, document mode, and target status are visible on `http://127.0.0.1:5174/`.
- Automated adapter test covers writable open, writable save, external conflict, fallback import, and permission-denied writable stream errors.

Human OS-backed smoke test result:

- Accepted in Google Chrome: open a real local Markdown file, edit it, save, and verify disk content changed.
- Known limitation: the Codex in-app browser is not considered authoritative for native file-handle persistence.
