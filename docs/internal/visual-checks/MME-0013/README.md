# MME-0013 Visual Checks

## Manual UI scenario

1. Start or keep running the demo with `npm run dev -w @momentarise/md-demo -- --host :: --port 5174 --strictPort`.
2. Open `http://localhost:5174/`.
3. Load a Markdown document and switch to Rich mode.
4. Confirm the rich command toolbar is visible.
5. Open the More menu and confirm secondary commands are visible.
6. Confirm ArrowDown moves slash-menu selection while focus remains in the rich editor.
7. Type `/h1` and confirm the slash menu filters to the H1 command.
8. Run the H1 command and confirm Markdown serializes as a heading.
9. Run toolbar commands for todo and code block.
10. Confirm an unsupported inline command in a code block is a no-op and keeps the typed text.
11. Confirm source/rich switching still produces valid Markdown.

## Expected artifacts

- `rich-toolbar-loaded.png` — proves the toolbar appears in rich mode.
- `toolbar-more-menu-open.png` — proves secondary toolbar commands are reachable.
- `slash-menu-keyboard-navigation.png` — proves keyboard navigation changes slash-menu selection from the editor.
- `slash-menu-heading-query.png` — proves `/h1` filters the slash menu to heading commands.
- `heading-command-applied.png` — proves a slash command changes the selected block.
- `toolbar-todo-code-applied.png` — proves toolbar commands affect rich blocks and serialize to Markdown.

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host :: --port 5174 --strictPort`
- Local URL: `http://localhost:5174/`
- Visual scenario: `MME_DEMO_URL=http://localhost:5174/ npm run visual:mme-0013`

## Human review status

MME-0013 status is `code-complete/pending human review` until the first command UI slice is accepted by a human.
