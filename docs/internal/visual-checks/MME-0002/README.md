# MME-0002 Visual Checks

## Manual UI scenario

1. Start the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1`.
2. Open the documented local URL in the browser.
3. Capture `initial-demo-loaded.png` to prove the demo opens with CodeMirror visible and no textarea UI.
4. Type Markdown containing a heading, paragraph, list item, checkbox item, code fence, brackets, quotes, and backticks.
5. Capture `editor-after-typing-markdown.png` to prove the editor accepts Markdown text and normal multiline input.
6. Verify selection, copy/paste, undo, and redo.
7. Capture `dirty-state-after-edit.png` to prove dirty state updates after edits.
8. Press `Cmd/Ctrl+S`.
9. Capture `save-shortcut-event-log.png` to prove the save shortcut is captured and delegated to memory-only persistence.

## Expected artifacts

- `initial-demo-loaded.png`
- `editor-after-typing-markdown.png`
- `dirty-state-after-edit.png`
- `save-shortcut-event-log.png`

## Generated artifacts

- `initial-demo-loaded.png`: proves the demo loads at `http://127.0.0.1:5173/`, shows CodeMirror 6, and labels the fixture as memory-only/not persisted.
- `editor-after-typing-markdown.png`: proves Markdown editing accepts headings, list items, todo items, inline code, brackets, quotes, and normal multiline content.
- `dirty-state-after-edit.png`: proves the editor enters `dirty` state after edits while keeping the persistence target honest.
- `save-shortcut-event-log.png`: proves `Cmd/Ctrl+S` is captured and delegated to memory-only persistence without claiming disk persistence.

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1`
- Local URL: `http://127.0.0.1:5173/`
- Visual scenario: `npm run visual:mme-0002`

## Human review required

Human review required before MME-0002 can be accepted as the first UI slice.
